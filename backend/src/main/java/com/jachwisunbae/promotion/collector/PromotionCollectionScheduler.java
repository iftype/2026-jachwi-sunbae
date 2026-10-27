package com.jachwisunbae.promotion.collector;

import com.jachwisunbae.promotion.service.PromotionCollectionService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "promotion.collection.enabled", havingValue = "true")
public class PromotionCollectionScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(PromotionCollectionScheduler.class);

    private final PromotionCollectionService service;

    public PromotionCollectionScheduler(final PromotionCollectionService service) {
        this.service = service;
    }

    // 기본 스케줄러는 스레드 하나로 작업을 차례로 실행하므로 최초 수집과 정기 수집이 겹치지 않는다.
    // 실패해도 즉시 재시도하지 않고 다음 날 수집에서 다시 시도한다.
    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    public void collect() {
        run(service::collect);
    }

    // 기동 5분 뒤 한 번만 실행해, 저장된 목록이 없으면 다음 04:00을 기다리지 않고 적재한다.
    @Scheduled(initialDelay = 5, timeUnit = TimeUnit.MINUTES)
    public void collectInitially() {
        run(service::collectIfEmpty);
    }

    private void run(final Runnable collection) {
        try {
            collection.run();
        } catch (RuntimeException exception) {
            LOG.warn("promotion-scheduled-collection-failed exceptionType={}", exception.getClass().getSimpleName());
        }
    }
}
