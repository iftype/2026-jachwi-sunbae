package com.jachwisunbae.transit.service;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.ServiceUnavailableException;
import com.jachwisunbae.transit.domain.network.TransitNetwork;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

// 전국 노선망을 처음 탐색할 때 한 번 DB에서 읽어 서버 메모리에 둔다. 이후 탐색은 DB 커넥션 없이 메모리에서 계산한다.
// 적재는 별도 프로세스로 실행하므로, 다시 적재한 노선망과 행정동 코드는 서버를 재시작해야 반영된다.
// 노선망이 비어 있거나 읽지 못하면 담아 두지 않고, RETRY_DELAY가 지난 뒤 요청에서 다시 읽는다.
@Component
public class TransitNetworkCache {

    // DB에 연결하지 못하면 읽기 한 번이 커넥션 타임아웃(30초)만큼 걸린다.
    // 실패한 뒤 바로 다시 읽으면 기다리던 요청마다 같은 실패를 차례로 반복하므로, 이 시간 동안은 읽지 않고 바로 실패시킨다.
    static final Duration RETRY_DELAY = Duration.ofSeconds(30);

    private final TransitNetworkLoader transitNetworkLoader;
    private final Clock clock;
    private volatile TransitNetwork network;
    private volatile Instant retryAt = Instant.MIN;

    public TransitNetworkCache(final TransitNetworkLoader transitNetworkLoader, final Clock clock) {
        this.transitNetworkLoader = transitNetworkLoader;
        this.clock = clock;
    }

    // 처음 요청이 동시에 몰려도 노선망은 한 번만 읽는다.
    public TransitNetwork get() {
        TransitNetwork loaded = network;
        if (loaded != null) {
            return loaded;
        }
        rejectBeforeRetry();
        synchronized (this) {
            if (network == null) {
                rejectBeforeRetry();
                network = load();
            }
            return network;
        }
    }

    private TransitNetwork load() {
        try {
            return transitNetworkLoader.load();
        } catch (RuntimeException exception) {
            retryAt = clock.instant().plus(RETRY_DELAY);
            throw exception;
        }
    }

    private void rejectBeforeRetry() {
        if (clock.instant().isBefore(retryAt)) {
            throw new ServiceUnavailableException(ErrorCode.TRANSIT_NETWORK_UNAVAILABLE,
                    "대중교통 노선망을 읽지 못해 " + retryAt + " 이후에 다시 읽습니다.");
        }
    }
}
