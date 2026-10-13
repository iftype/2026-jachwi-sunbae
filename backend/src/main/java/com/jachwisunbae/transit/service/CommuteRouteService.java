package com.jachwisunbae.transit.service;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.transit.domain.CommuteRoute;
import com.jachwisunbae.transit.domain.collection.TransitNetwork;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommuteRouteService {

    private final TransitNetworkCache transitNetworkCache;

    public CommuteRouteService(final TransitNetworkCache transitNetworkCache) {
        this.transitNetworkCache = transitNetworkCache;
    }

    // 처음 요청에서 노선망을 읽을 때 적재와 겹쳐도 한 시점의 노선망을 읽도록 읽기 트랜잭션으로 묶는다.
    @Transactional(readOnly = true)
    public CommuteRoute findRoute(final String stopId, final Coordinate destination, final int maxMinutes,
                                  final int maxTransfers) {
        TransitNetwork network = transitNetworkCache.get();
        if (!network.hasStop(stopId)) {
            throw new ResourceNotFoundException(ErrorCode.TRANSIT_STOP_NOT_FOUND, "정류장이 없습니다. stopId=" + stopId);
        }
        if (!network.hasArrivalStop(destination)) {
            throw new BusinessRuleViolationException(ErrorCode.COMMUTE_DESTINATION_UNREACHABLE,
                    "목적지 주변에 도착 정류장이 없습니다. destination=" + destination);
        }
        return network.route(stopId, destination, new Seconds(maxMinutes * 60), maxTransfers)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.COMMUTE_ROUTE_NOT_FOUND,
                        "제한 안에 목적지까지 가는 경로가 없습니다. stopId=" + stopId + " destination=" + destination));
    }
}
