package com.jachwisunbae.notification.scheduler;

import com.jachwisunbae.notification.domain.DeliveryDiscountNotificationType;
import com.jachwisunbae.notification.service.DeliveryDiscountNotificationService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// 실제 사용자 발송은 별도 결정 전까지 꺼 둔다. 켜려면 delivery-discount.notification.enabled=true가 필요하다.
@Component
@ConditionalOnProperty(name = "delivery-discount.notification.enabled", havingValue = "true")
public class DeliveryDiscountNotificationScheduler {
    private final DeliveryDiscountNotificationService service;

    public DeliveryDiscountNotificationScheduler(final DeliveryDiscountNotificationService service) {
        this.service = service;
    }

    @Scheduled(cron = "0 0 10 * * *", zone = "Asia/Seoul")
    public void baeminFirstCome() {
        service.dispatch(DeliveryDiscountNotificationType.BAEMIN_FIRST_COME);
    }

    @Scheduled(cron = "0 0 22 * * *", zone = "Asia/Seoul")
    public void closingSoon() {
        service.dispatch(DeliveryDiscountNotificationType.CLOSING_SOON);
    }
}
