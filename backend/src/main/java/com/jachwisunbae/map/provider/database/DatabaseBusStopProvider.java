package com.jachwisunbae.map.provider.database;

import com.jachwisunbae.map.domain.BusStop;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.provider.BusStopProvider;
import com.jachwisunbae.map.repository.BusStopRepository;
import com.jachwisunbae.map.type.MapCategory;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

// 서비스 DB에 적재한 전국 버스정류장에서 반경 안의 정류장을 찾는다.
@Component
public class DatabaseBusStopProvider implements BusStopProvider {

    private static final String BUS_STOP_LABEL = "버스정류소";
    private final BusStopRepository busStopRepository;

    public DatabaseBusStopProvider(BusStopRepository busStopRepository) {
        this.busStopRepository = busStopRepository;
    }

    // 사각형으로 후보를 좁힌 뒤 실제 거리로 사각형 모서리 부분을 걸러 내고 가까운 순으로 정렬한다.
    // 반경 비교는 반올림 전 거리로 해서, 사각형과 같은 기준으로 경계를 판단한다.
    @Override
    public List<NearbyPlace> nearby(BigDecimal latitude, BigDecimal longitude, int radius) {
        CoordinateBounds bounds = CoordinateBounds.around(latitude, longitude, radius);
        return busStopRepository.findAllWithin(bounds).stream()
                .map(busStop -> new Candidate(busStop, busStop.distanceMetersFrom(latitude, longitude)))
                .filter(candidate -> candidate.distanceMeters() <= radius)
                .sorted(Comparator.comparingDouble(Candidate::distanceMeters)
                        .thenComparing(candidate -> candidate.busStop().getNodeId()))
                .map(this::toPlace)
                .toList();
    }

    // 정류장 ID 체계가 TAGO와 같아 기존 providerPlaceId 규칙을 유지한다.
    private NearbyPlace toPlace(Candidate candidate) {
        BusStop busStop = candidate.busStop();
        String providerPlaceId = "tago:" + busStop.getCityCode() + ":" + busStop.getNodeId();
        return new NearbyPlace(providerPlaceId, busStop.getName(), MapCategory.TRANSPORT, BUS_STOP_LABEL,
                busStop.getLatitude(), busStop.getLongitude(), (int) Math.round(candidate.distanceMeters()));
    }

    private record Candidate(BusStop busStop, double distanceMeters) {
    }
}
