package com.jachwisunbae.notification.config;

import com.jachwisunbae.notification.provider.WeatherPushSender;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "weather.notification.enabled", havingValue = "false", matchIfMissing = true)
public class DisabledWeatherPushConfig {
    @Bean
    @ConditionalOnMissingBean(WeatherPushSender.class)
    public WeatherPushSender disabledWeatherPushSender() {
        return push -> false;
    }
}
