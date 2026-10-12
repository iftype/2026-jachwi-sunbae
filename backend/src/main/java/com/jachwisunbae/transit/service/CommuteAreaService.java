package com.jachwisunbae.transit.service;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.ServiceUnavailableException;
import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.CommuteArea;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.collection.TransitNetwork;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.repository.AdminDongRepository;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
import com.jachwisunbae.transit.service.dto.result.CommuteAreaSearchResult;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommuteAreaService {

    private final GtfsNetworkRepository gtfsNetworkRepository;
    private final AdminDongRepository adminDongRepository;

    public CommuteAreaService(final GtfsNetworkRepository gtfsNetworkRepository,
                              final AdminDongRepository adminDongRepository) {
        this.gtfsNetworkRepository = gtfsNetworkRepository;
        this.adminDongRepository = adminDongRepository;
    }

    // 요청마다 노선망을 DB에서 읽는다. 적재와 겹쳐도 한 시점의 노선망을 읽도록 읽기 트랜잭션으로 묶는다.
    @Transactional(readOnly = true)
    public CommuteAreaSearchResult search(final Coordinate destination, final int maxMinutes,
                                          final int maxTransfers) {
        TransitNetwork network = loadNetwork();
        if (!network.hasArrivalStop(destination)) {
            throw new BusinessRuleViolationException(ErrorCode.COMMUTE_DESTINATION_UNREACHABLE,
                    "목적지 주변에 도착 정류장이 없습니다. destination=" + destination);
        }
        List<ReachableStop> reachableStops = network.reachableStops(destination, new Seconds(maxMinutes * 60),
                maxTransfers);
        return new CommuteAreaSearchResult(maxMinutes, toCommuteAreas(reachableStops));
    }

    private TransitNetwork loadNetwork() {
        List<GtfsStop> stops = gtfsNetworkRepository.findStops();
        if (stops.isEmpty()) {
            throw new ServiceUnavailableException(ErrorCode.TRANSIT_NETWORK_UNAVAILABLE,
                    "대중교통 노선망이 적재되지 않았습니다.");
        }
        return new TransitNetwork(stops, gtfsNetworkRepository.findRoutes(), gtfsNetworkRepository.findEdges(),
                gtfsNetworkRepository.findTransfers());
    }

    // 행정동을 찾지 못한 정류장은 뺀다. 정류장이 통근 시간 순서이므로 묶은 뒤에도 동네 안 정류장은 그 순서를 따른다.
    private List<CommuteArea> toCommuteAreas(final List<ReachableStop> reachableStops) {
        Map<String, List<ReachableStop>> stopsByCode = reachableStops.stream()
                .filter(stop -> stop.adminDongCode() != null)
                .collect(Collectors.groupingBy(ReachableStop::adminDongCode, LinkedHashMap::new,
                        Collectors.toList()));
        Map<String, AdminDong> adminDongs = adminDongRepository.findByCodes(stopsByCode.keySet()).stream()
                .collect(Collectors.toMap(AdminDong::code, Function.identity()));
        List<CommuteArea> areas = new ArrayList<>();
        stopsByCode.forEach((code, stations) -> {
            AdminDong adminDong = adminDongs.get(code);
            if (adminDong != null) {
                areas.add(new CommuteArea(adminDong, stations));
            }
        });
        areas.sort(Comparator.comparingInt(CommuteArea::commuteMinutes)
                .thenComparing(area -> area.adminDong().code()));
        return areas;
    }
}
