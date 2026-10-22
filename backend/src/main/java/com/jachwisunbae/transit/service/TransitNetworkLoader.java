package com.jachwisunbae.transit.service;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.ServiceUnavailableException;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.network.TransitNetwork;
import com.jachwisunbae.transit.domain.network.TransitNetworkBuilder;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// 전국 노선망을 DB에서 읽어 탐색용 노선망을 만든다. 구간은 목록으로 모으지 않고 읽는 대로 번호 배열에 담아 메모리 피크를 줄인다.
// 정류장·노선·구간·환승을 따로 조회하므로, 적재와 겹쳐도 한 시점의 노선망을 읽도록 이 메서드만 읽기 트랜잭션으로 묶는다.
// TransitNetworkCache 안에서 부르면 트랜잭션 프록시를 거치지 않으므로 별도 빈으로 둔다.
@Component
public class TransitNetworkLoader {

    private final GtfsNetworkRepository gtfsNetworkRepository;

    public TransitNetworkLoader(final GtfsNetworkRepository gtfsNetworkRepository) {
        this.gtfsNetworkRepository = gtfsNetworkRepository;
    }

    @Transactional(readOnly = true)
    public TransitNetwork load() {
        List<GtfsStop> stops = gtfsNetworkRepository.findStops();
        if (stops.isEmpty()) {
            throw new ServiceUnavailableException(ErrorCode.TRANSIT_NETWORK_UNAVAILABLE,
                    "대중교통 노선망이 적재되지 않았습니다.");
        }
        TransitNetworkBuilder builder = TransitNetwork.builder(stops, gtfsNetworkRepository.findRoutes());
        gtfsNetworkRepository.forEachEdge(builder::addEdge);
        gtfsNetworkRepository.findTransfers().forEach(builder::addTransfer);
        return builder.build();
    }
}
