package com.jachwisunbae.transit.service;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.transit.domain.CapitalRegion;
import com.jachwisunbae.transit.domain.CommuteArea;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.collection.TransitNetwork;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.service.dto.result.CommuteAreaSearchResult;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class CommuteAreaService {

    private final TransitNetworkCache transitNetworkCache;

    public CommuteAreaService(final TransitNetworkCache transitNetworkCache) {
        this.transitNetworkCache = transitNetworkCache;
    }

    public CommuteAreaSearchResult search(final Coordinate destination, final int maxMinutes,
                                          final int maxTransfers) {
        TransitNetwork network = transitNetworkCache.get();
        if (!network.hasArrivalStop(destination)) {
            throw new BusinessRuleViolationException(ErrorCode.COMMUTE_DESTINATION_UNREACHABLE,
                    "목적지 주변에 도착 정류장이 없습니다. destination=" + destination);
        }
        List<ReachableStop> reachableStops = network.reachableStops(destination, new Seconds(maxMinutes * 60),
                maxTransfers);
        return new CommuteAreaSearchResult(maxMinutes, toCommuteAreas(reachableStops));
    }

    private List<CommuteArea> toCommuteAreas(final List<ReachableStop> reachableStops) {
        Map<String, List<ReachableStop>> stopsByCode = reachableStops.stream()
                .filter(stop -> CapitalRegion.includesInResult(stop.adminDongCode()))
                .collect(Collectors.groupingBy(ReachableStop::adminDongCode, LinkedHashMap::new,
                        Collectors.toList()));
        return stopsByCode.entrySet().stream()
                .map(entry -> new CommuteArea(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparingInt(CommuteArea::commuteMinutes)
                        .thenComparing(CommuteArea::adminDongCode))
                .toList();
    }
}
