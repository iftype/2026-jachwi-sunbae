package com.jachwisunbae.weather.config;

import com.jachwisunbae.weather.cleanup.WeatherCleanupScheduler;
import com.jachwisunbae.weather.collector.WeatherCollectionScheduler;
import com.jachwisunbae.weather.service.WeatherCleanupService;
import com.jachwisunbae.weather.service.WeatherCollectionService;
import java.time.Clock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration(proxyBeanMethods = false)
@EnableScheduling // SPring 내부 처리기 -
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnExpression("${weather.collection.enabled:false} or ${weather.cleanup.enabled:false}")
public class WeatherSchedulingConfig {

    private static final Logger LOG = LoggerFactory.getLogger(WeatherSchedulingConfig.class);

    //빈 1. 전용 스레드
    // 수집은 이 전용 스레드에서 돌아서, 웹 요청을 처리하는 톰캣 스레드와 섞이지 않는다. 로그에서도 weather-collection-1 같은 스레드 이름으로 구분된다.
    // ErrorHandler는 예외 타입 이름만 남긴다. 메시지에 URL·API 키가 들어 있을 수 있어서.

    @Bean
    public ThreadPoolTaskScheduler weatherTaskScheduler(final Clock clock) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("weather-collection-");
        scheduler.setClock(clock);
        scheduler.setErrorHandler(exception -> LOG.error("weather-scheduler-error exceptionType={}",
                exception.getClass().getSimpleName()));
        return scheduler;
    }

    //빈 2. 스케줄러 객체
    //
    @Bean
    @ConditionalOnProperty(name = "weather.collection.enabled", havingValue = "true")
    public WeatherCollectionScheduler weatherCollectionScheduler(final WeatherCollectionService service, final Clock clock,
            @Value("${weather.collection.publication-delay-minutes:15}") final long publicationDelayMinutes) {
        return new WeatherCollectionScheduler(service, clock, Duration.ofMinutes(publicationDelayMinutes));
    }

    @Bean
    @ConditionalOnProperty(name = "weather.cleanup.enabled", havingValue = "true")
    public WeatherCleanupScheduler weatherCleanupScheduler(final WeatherCleanupService service) {
        return new WeatherCleanupScheduler(service);
    }

    //빈 3. 작업 등록
    @Bean
    public SchedulingConfigurer weatherSchedulingConfigurer(final ObjectProvider<WeatherCollectionScheduler> collectors,
            final ObjectProvider<WeatherCleanupScheduler> cleaners,
            @Qualifier("weatherTaskScheduler") final TaskScheduler scheduler) {
        return registrar -> {
            registrar.setTaskScheduler(scheduler);
            //1번 인자 - runnable  2번 인자 - Trigger
            //registrar가 등록된 작업을 weatherTaskScheduler에 넘겨 예약 시작
            collectors.ifAvailable(collector -> registrar.addTriggerTask(collector::collect, collector::nextExecution));
            cleaners.ifAvailable(cleaner -> registrar.addTriggerTask(cleaner::cleanup, cleaner::nextExecution));
        };
    }
}
