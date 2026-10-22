package com.jachwisunbae.transit.service;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.transit.domain.CommuteRoute;
import com.jachwisunbae.transit.domain.network.TransitNetwork;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import org.springframework.stereotype.Service;

@Service
public class CommuteRouteService {

    private final TransitNetworkCache transitNetworkCache;

    public CommuteRouteService(final TransitNetworkCache transitNetworkCache) {
        this.transitNetworkCache = transitNetworkCache;
    }

    // 노선망은 메모리에 두고 계산만 하므로 트랜잭션을 열지 않는다. 처음 읽을 때만 TransitNetworkLoader가 연다.
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
