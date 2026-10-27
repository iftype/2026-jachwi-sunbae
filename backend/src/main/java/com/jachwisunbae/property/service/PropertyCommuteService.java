package com.jachwisunbae.property.service;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.property.repository.PropertyRepository;
import com.jachwisunbae.property.repository.query.PropertyLocationQuery;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteStatus;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteTime;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteTimes;
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
        TransitNetwork network = transitNetworkCache.get();
        if (!network.hasArrivalStop(destination)) {
            throw new BusinessRuleViolationException(ErrorCode.COMMUTE_DESTINATION_UNREACHABLE,
                    "목적지 주변에 도착 정류장이 없습니다. destination=" + destination);
        }
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
