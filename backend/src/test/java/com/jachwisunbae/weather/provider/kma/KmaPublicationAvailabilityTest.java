package com.jachwisunbae.weather.provider.kma;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.weather.service.collection.WeatherCollectionPlan;
import com.jachwisunbae.weather.support.ForecastTimesFixture;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

class KmaPublicationAvailabilityTest {

    @Test
    @EnabledIfEnvironmentVariable(named = "WEATHER_AVAILABILITY_PUBLISHED_AT", matches = "[0-9]{10}")
    @DisplayName("명시한 발표분의 모든 계획 요청을 실제 호출해 공개 여부와 관측 시각을 기록한다")
    void observesAvailability() throws Exception {
        String publication = System.getenv("WEATHER_AVAILABILITY_PUBLISHED_AT");
        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(
                ForecastTimesFixture.times(publication, publication).publishedAt());
        KmaForecastClient client = new KmaForecastClient(System.getenv("KMA_API_KEY"));
        Instant publishedAt = plan.publishedAt().atZone(ZoneId.of("Asia/Seoul")).toInstant();
        Instant startedAt = Instant.now();
        List<String> observations = new ArrayList<>();
        observations.add("tmfc,tmef,element,observedAtUtc,secondsAfterPublication,status,responseBytes,validValues,missingValues");
        int valid = 0;
        for (KmaForecastRequest request : plan.requests()) {
            String values;
            try {
                ForecastFetchResult fetched = client.fetchMeasured(request);
                values = "VALID," + fetched.responseBytes() + "," + fetched.forecast().validCount()
                        + "," + fetched.forecast().missingCount();
                valid++;
            } catch (UpstreamServiceException exception) {
                values = exception.getErrorCode().name() + ",0,0,0";
            }
            Instant observedAt = Instant.now();
            observations.add(request.tmfc() + "," + request.tmef() + "," + request.element() + "," + observedAt
                    + "," + Duration.between(publishedAt, observedAt).toSeconds() + "," + values);
        }
        Instant finishedAt = Instant.now();
        Path directory = Path.of("build/weather-availability", publication, startedAt.toString().replace(':', '-'));
        Files.createDirectories(directory);
        Files.write(directory.resolve("requests.csv"), observations);
        String summary = "publishedAtKst=" + plan.publishedAt() + "\nstartedAtUtc=" + startedAt
                + "\nfinishedAtUtc=" + finishedAt + "\nvalidRequests=" + valid + "\nplannedRequests=" + plan.requestCount()
                + "\nallAvailable=" + (valid == plan.requestCount())
                + "\nsecondsAfterPublicationAtEnd=" + Duration.between(publishedAt, finishedAt).toSeconds()
                + "\nThis is an observation time, not the first availability time.\n";
        Files.writeString(directory.resolve("summary.txt"), summary);
        System.out.println("weather-availability-observation " + summary.replace('\n', ' '));
        assertThat(valid).as("공개 여부 관측 결과는 %s에 기록했다", directory).isEqualTo(plan.requestCount());
    }
}
