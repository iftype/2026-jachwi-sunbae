package com.jachwisunbae.transit.service.search;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

// 웹 서버가 뜰 때 노선망을 미리 읽어, 첫 탐색 요청이 노선망을 읽느라 수 초씩 기다리지 않게 한다.
// 적재 모드(web-application-type=none)에서는 만들지 않는다.
// 노선망이 비어 있거나 DB를 읽지 못해도 서버는 그대로 띄우고, 잠시 뒤 탐색 요청에서 다시 읽는다(TransitNetworkCache.RETRY_DELAY).
@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class TransitNetworkPreloader {

    private static final Logger LOG = LoggerFactory.getLogger(TransitNetworkPreloader.class);

    private final TransitNetworkCache transitNetworkCache;

    public TransitNetworkPreloader(final TransitNetworkCache transitNetworkCache) {
        this.transitNetworkCache = transitNetworkCache;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void preload() {
        long startedAt = System.currentTimeMillis();
        try {
            transitNetworkCache.get();
            LOG.info("대중교통 노선망을 메모리에 올렸습니다. elapsedMillis={}", System.currentTimeMillis() - startedAt);
        } catch (RuntimeException exception) {
            LOG.warn("대중교통 노선망을 미리 읽지 못했습니다. 잠시 뒤 탐색 요청에서 다시 읽습니다. reason={}",
                    exception.getMessage());
        }
    }
}
