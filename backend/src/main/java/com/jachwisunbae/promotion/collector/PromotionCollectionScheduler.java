package com.jachwisunbae.promotion.collector;

import com.jachwisunbae.promotion.service.PromotionCollectionService;
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

    // cron 작업은 이전 실행이 끝난 뒤 다음 실행을 예약하므로 같은 서버에서 겹쳐 실행되지 않는다.
    // 실패해도 즉시 재시도하지 않고 다음 날 수집에서 다시 시도한다.
    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    public void collect() {
        try {
            service.collect();
        } catch (RuntimeException exception) {
            LOG.warn("promotion-scheduled-collection-failed exceptionType={}", exception.getClass().getSimpleName());
        }
    }
}
