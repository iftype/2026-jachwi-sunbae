package com.jachwisunbae.weather.cleanup;

import com.jachwisunbae.JachwiSunbaeBackendApplication;
import com.jachwisunbae.weather.service.WeatherCleanupService;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

// 삭제 기준일은 서비스의 Clock으로 결정하며 외부에서 미래 날짜를 지정할 수 없다.
public class WeatherCleanupCommand {

    public static void main(final String[] arguments) {
        if (arguments.length != 0) {
            throw new IllegalArgumentException("날씨 정리 명령은 인자를 받지 않습니다. KST 오늘 이전의 예보만 정리합니다.");
        }
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(JachwiSunbaeBackendApplication.class)
                .web(WebApplicationType.NONE)
                .run(arguments)) {
            execute(context.getBean(WeatherCleanupService.class));
        }
    }

    static void execute(final WeatherCleanupService service) {
        service.cleanup();
    }
}
