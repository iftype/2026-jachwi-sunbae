package com.jachwisunbae.weather.collector;

import com.jachwisunbae.weather.service.WeatherCollectionService;
import com.jachwisunbae.weather.service.collection.WeatherPublicationSchedule;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// 기상청 단기예보 발표 주기에 맞춰 최신 발표분을 자동 수집한다.
// weather.collection.enabled=true인 웹 애플리케이션에서만 등록된다.
@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnProperty(name = "weather.collection.enabled", havingValue = "true")
public class WeatherCollectionScheduler {
    private final WeatherCollectionService service;
    private final Clock clock;

    public WeatherCollectionScheduler(final WeatherCollectionService service, final Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    // 발표(02시부터 3시간 간격) 직후에는 데이터가 아직 제공되지 않을 수 있어 15분 뒤에 실행한다.
    @Scheduled(cron = "0 15 2,5,8,11,14,17,20,23 * * *", zone = "Asia/Seoul")
    public void collect() {
        try {
            // 현재 KST 시각 기준으로 지금 받을 수 있는 가장 최근 발표 시각을 수집한다.
            service.collect(WeatherPublicationSchedule.latestAt(LocalDateTime.ofInstant(clock.instant(), ZoneId.of("Asia/Seoul"))));
        } catch (RuntimeException exception) {
            // 수집 실패는 경고 로그로만 남기고, 예외 메시지 대신 예외 타입만 기록한다.
            LoggerFactory.getLogger(getClass()).warn("weather-scheduled-collection-failed exceptionType={}",
                    exception.getClass().getSimpleName());
        }
    }
}
