package com.jachwisunbae.transit.service;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.ServiceUnavailableException;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.collection.TransitNetwork;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
import java.util.List;
import org.springframework.stereotype.Component;

// 전국 노선망을 처음 탐색할 때 한 번 DB에서 읽어 서버 메모리에 둔다.
// 적재는 별도 프로세스로 실행하므로, 다시 적재한 노선망과 행정동 코드는 서버를 재시작해야 반영된다.
// 노선망이 비어 있으면 담아 두지 않아, 적재를 마친 뒤 다음 요청에서 바로 읽는다.
@Component
public class TransitNetworkCache {

    private final GtfsNetworkRepository gtfsNetworkRepository;
    private volatile TransitNetwork network;

    public TransitNetworkCache(final GtfsNetworkRepository gtfsNetworkRepository) {
        this.gtfsNetworkRepository = gtfsNetworkRepository;
    }

    // 처음 요청이 동시에 몰려도 노선망은 한 번만 읽는다.
    public TransitNetwork get() {
        TransitNetwork loaded = network;
        if (loaded != null) {
            return loaded;
        }
        synchronized (this) {
            if (network == null) {
                network = load();
            }
            return network;
        }
    }

    private TransitNetwork load() {
        List<GtfsStop> stops = gtfsNetworkRepository.findStops();
        if (stops.isEmpty()) {
            throw new ServiceUnavailableException(ErrorCode.TRANSIT_NETWORK_UNAVAILABLE,
                    "대중교통 노선망이 적재되지 않았습니다.");
        }
        return new TransitNetwork(stops, gtfsNetworkRepository.findRoutes(), gtfsNetworkRepository.findEdges(),
                gtfsNetworkRepository.findTransfers());
    }
}
