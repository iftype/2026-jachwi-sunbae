package com.jachwisunbae.weather.collector;

import com.jachwisunbae.JachwiSunbaeBackendApplication;
import com.jachwisunbae.weather.service.WeatherCollectionService;
import com.jachwisunbae.weather.service.collection.WeatherCollectionPlan;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.Locale;
import java.util.Set;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

// 명시한 KST 발표분을 한 번 수집하고 종료한다. 일반 서버 기동 경로에는 등록하지 않는다.
public class WeatherCollectionCommand {

    private static final DateTimeFormatter PUBLICATION_FORMAT = DateTimeFormatter.ofPattern("uuuuMMddHH", Locale.ROOT)
            .withResolverStyle(ResolverStyle.STRICT);

    public static void main(final String[] arguments) {
        LocalDateTime publishedAt = parsePublication(arguments);
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(JachwiSunbaeBackendApplication.class)
                .web(WebApplicationType.NONE)
                .run(arguments)) {
            context.getBean(WeatherCollectionService.class).collect(publishedAt);
        }
    }

    static LocalDateTime parsePublication(final String[] arguments) {
        DefaultApplicationArguments args = new DefaultApplicationArguments(arguments);
        if (!args.getOptionNames().equals(Set.of("published-at")) || !args.getNonOptionArgs().isEmpty()) {
            throw new IllegalArgumentException("--published-at=yyyyMMddHH 형식으로 KST 발표시각 하나가 필요합니다.");
        }
        var values = args.getOptionValues("published-at");
        if (values == null || values.size() != 1 || values.getFirst().isBlank()) {
            throw new IllegalArgumentException("--published-at 값은 하나여야 합니다.");
        }
        LocalDateTime publishedAt = parsePublicationValue(values.getFirst());
        return WeatherCollectionPlan.forPublication(publishedAt).publishedAt();
    }

    private static LocalDateTime parsePublicationValue(final String value) {
        if (!value.matches("[0-9]{10}")) {
            throw new IllegalArgumentException("발표 시각은 KST yyyyMMddHH 형식이어야 합니다.");
        }
        try {
            return LocalDateTime.parse(value, PUBLICATION_FORMAT);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("발표 시각에 유효한 날짜와 시간이 필요합니다.");
        }
    }
}
