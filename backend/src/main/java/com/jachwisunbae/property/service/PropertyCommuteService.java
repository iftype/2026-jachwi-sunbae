package com.jachwisunbae.property.service;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.repository.PropertyRepository;
import com.jachwisunbae.property.repository.query.PropertyLocationQuery;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteStatus;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteTime;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteTimes;
import com.jachwisunbae.transit.domain.CommuteRoute;
import com.jachwisunbae.transit.domain.network.TransitNetwork;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.service.TransitNetworkCache;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

// 회원의 매물마다 목적지까지 대중교통으로 걸리는 시간을 구한다. 생활권 탐색과 같은 노선망 규칙을 쓰고,
// 매물에서 걸어서 10분 안의 정류장까지 걷는 시간을 더한다.
@Service
public class PropertyCommuteService {

    static final int MAX_MINUTES = 60;
    static final int MAX_TRANSFERS = 2;

    private final PropertyRepository propertyRepository;
    private final TransitNetworkCache transitNetworkCache;

    public PropertyCommuteService(final PropertyRepository propertyRepository,
                                  final TransitNetworkCache transitNetworkCache) {
        this.propertyRepository = propertyRepository;
        this.transitNetworkCache = transitNetworkCache;
    }

    public PropertyCommuteTimes findCommuteTimes(final long memberId, final Coordinate destination) {
        TransitNetwork network = networkReaching(destination);
        List<PropertyLocationQuery> properties = propertyRepository.findLocationsByMemberId(memberId);
        List<PropertyLocationQuery> located = properties.stream().filter(PropertyLocationQuery::hasLocation).toList();
        List<Optional<Seconds>> travelTimes = network.travelTimes(destination,
                located.stream().map(PropertyCommuteService::coordinate).toList(),
                new Seconds(MAX_MINUTES * 60), MAX_TRANSFERS);

        List<PropertyCommuteTime> results = new ArrayList<>();
        int next = 0;
        for (PropertyLocationQuery property : properties) {
            if (!property.hasLocation()) {
                results.add(new PropertyCommuteTime(property.propertyId(), property.propertyName(),
                        PropertyCommuteStatus.NO_LOCATION, null));
                continue;
            }
            results.add(toCommuteTime(property, travelTimes.get(next++)));
        }
        return new PropertyCommuteTimes(MAX_MINUTES, MAX_TRANSFERS, results);
    }

    // 매물 하나에서 목적지까지의 동선이다. 매물별 통근 시간과 같은 조건(60분, 환승 2회)과 같은 첫 정류장 선택을 쓴다.
    public CommuteRoute findCommuteRoute(final long memberId, final long propertyId, final Coordinate destination) {
        Property property = propertyRepository.findByIdAndMemberId(propertyId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
                        "propertyId=" + propertyId + " 매물이 없습니다."));
        if (property.getLatitude() == null || property.getLongitude() == null) {
            throw new BusinessRuleViolationException(ErrorCode.PROPERTY_LOCATION_REQUIRED,
                    "propertyId=" + propertyId + " 매물에 위치가 없습니다.");
        }
        Coordinate origin = new Coordinate(property.getLatitude().doubleValue(),
                property.getLongitude().doubleValue());
        return networkReaching(destination)
                .routeFrom(origin, destination, new Seconds(MAX_MINUTES * 60), MAX_TRANSFERS)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.COMMUTE_ROUTE_NOT_FOUND,
                        "propertyId=" + propertyId + " 매물에서 제한 안에 목적지까지 가는 경로가 없습니다."));
    }

    private TransitNetwork networkReaching(final Coordinate destination) {
        TransitNetwork network = transitNetworkCache.get();
        if (!network.hasArrivalStop(destination)) {
            throw new BusinessRuleViolationException(ErrorCode.COMMUTE_DESTINATION_UNREACHABLE,
                    "목적지 주변에 도착 정류장이 없습니다. destination=" + destination);
        }
        return network;
    }

    private static PropertyCommuteTime toCommuteTime(final PropertyLocationQuery property,
                                                     final Optional<Seconds> travelTime) {
        return travelTime
                .map(time -> new PropertyCommuteTime(property.propertyId(), property.propertyName(),
                        PropertyCommuteStatus.REACHABLE, (time.value() + 59) / 60))
                .orElseGet(() -> new PropertyCommuteTime(property.propertyId(), property.propertyName(),
                        PropertyCommuteStatus.UNREACHABLE, null));
    }

    private static Coordinate coordinate(final PropertyLocationQuery property) {
        return new Coordinate(property.latitude().doubleValue(), property.longitude().doubleValue());
    }
}
