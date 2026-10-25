package com.jachwisunbae.weather.service.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import com.jachwisunbae.weather.support.ForecastTimesFixture;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.TimeZone;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class WeatherCollectionPlanTest {

    private static final LocalDate DATE = LocalDate.of(2026, 10, 22);

    @ParameterizedTest
    @CsvSource({
            "2, 2026102203, 2026102402",
            "5, 2026102206, 2026102405",
            "8, 2026102209, 2026102408",
            "11, 2026102212, 2026102411",
            "14, 2026102215, 2026102414",
            "17, 2026102218, 2026102417",
            "20, 2026102221, 2026102420",
            "23, 2026102300, 2026102423"
    })
    @DisplayName("8개 발표시각마다 다음 정시부터 연속 48시간의 8개 요소를 중복 없이 계획한다")
    void plansHourlyRequests(final int publicationHour, final String firstTarget, final String lastTarget) {
        LocalDateTime publishedAt = DATE.atTime(publicationHour, 0);

        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(publishedAt);

        assertThat(plan.hourlyRequests()).hasSize(384).doesNotHaveDuplicates();
        assertThat(plan.hourlyRequests()).allSatisfy(request ->
                assertThat(request.times().publishedAt()).isEqualTo(publishedAt));
        assertThat(plan.hourlyRequests().getFirst().tmef()).isEqualTo(firstTarget);
        assertThat(plan.hourlyRequests().getLast().tmef()).isEqualTo(lastTarget);
        for (int offset = 0; offset < 48; offset++) {
            List<KmaForecastRequest> hour = plan.hourlyRequests().subList(offset * 8, (offset + 1) * 8);
            assertThat(hour).extracting(KmaForecastRequest::element).containsExactly(
                    WeatherElement.TMP, WeatherElement.SKY, WeatherElement.PTY, WeatherElement.POP,
                    WeatherElement.PCP, WeatherElement.SNO, WeatherElement.REH, WeatherElement.WSD);
            LocalDateTime expectedTarget = publishedAt.plusHours(offset + 1);
            assertThat(hour).allSatisfy(request -> assertThat(request.times().forecastAt()).isEqualTo(expectedTarget));
        }
    }

    @ParameterizedTest
    @CsvSource({
            "2, TMN@2026102206;TMX@2026102215;TMN@2026102306;TMX@2026102315;TMN@2026102406;TMX@2026102415",
            "5, TMX@2026102215;TMN@2026102306;TMX@2026102315;TMN@2026102406;TMX@2026102415",
            "8, TMX@2026102215;TMN@2026102306;TMX@2026102315;TMN@2026102406;TMX@2026102415",
            "11, TMX@2026102215;TMN@2026102306;TMX@2026102315;TMN@2026102406;TMX@2026102415",
            "14, TMN@2026102306;TMX@2026102315;TMN@2026102406;TMX@2026102415",
            "17, TMN@2026102306;TMX@2026102315;TMN@2026102406;TMX@2026102415",
            "20, TMN@2026102306;TMX@2026102315;TMN@2026102406;TMX@2026102415",
            "23, TMN@2026102306;TMX@2026102315;TMN@2026102406;TMX@2026102415"
    })
    @DisplayName("대상 날짜별 TMN·TMX 제공 규칙에 따라 실제 요청 목록을 생성한다")
    void plansDailyRequests(final int publicationHour, final String expectedRequests) {
        LocalDateTime publishedAt = DATE.atTime(publicationHour, 0);

        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(publishedAt);

        assertThat(plan.dailyRequests()).extracting(request -> request.element() + "@" + request.tmef())
                .containsExactly(expectedRequests.split(";"));
        assertThat(plan.dailyRequests()).allSatisfy(request ->
                assertThat(request.times().publishedAt()).isEqualTo(publishedAt));
    }

    @Test
    @DisplayName("일별 기온은 시간별 구간에 걸친 날짜 전체를 대상으로 하므로 마지막 시간 뒤에도 요청할 수 있다")
    void plansDailyTemperaturesForWholeTargetDate() {
        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(DATE.atTime(2, 0));

        assertThat(plan.hourlyRequests().getLast().tmef()).isEqualTo("2026102402");
        assertThat(plan.dailyRequests()).contains(
                new KmaForecastRequest(new ForecastTimes(LocalDateTime.of(2026, 10, 22, 2, 0),
                LocalDateTime.of(2026, 10, 24, 6, 0)), WeatherElement.TMN),
                new KmaForecastRequest(new ForecastTimes(LocalDateTime.of(2026, 10, 22, 2, 0),
                LocalDateTime.of(2026, 10, 24, 15, 0)), WeatherElement.TMX));
    }

    @ParameterizedTest
    @CsvSource({
            "2026123123, 2027010100, 2027010223, 2027010106, 2027010115",
            "2026113020, 2026113021, 2026120220, 2026120106, 2026120115",
            "2028022823, 2028022900, 2028030123, 2028022906, 2028022915",
            "2028022923, 2028030100, 2028030223, 2028030106, 2028030115",
            "2027022823, 2027030100, 2027030223, 2027030106, 2027030115"
    })
    @DisplayName("KST 연말·월말·윤년의 시간별 구간과 일별 대상 날짜를 보존한다")
    void crossesCalendarBoundaries(final String publication, final String first, final String last,
                                   final String minimum, final String maximum) {
        LocalDateTime publishedAt = ForecastTimesFixture.times(publication, first).publishedAt();

        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(publishedAt);

        assertThat(plan.hourlyRequests().getFirst().tmef()).isEqualTo(first);
        assertThat(plan.hourlyRequests().getLast().tmef()).isEqualTo(last);
        assertThat(plan.dailyRequests()).containsExactly(
                new KmaForecastRequest(ForecastTimesFixture.times(publication, minimum), WeatherElement.TMN),
                new KmaForecastRequest(ForecastTimesFixture.times(publication, maximum), WeatherElement.TMX),
                new KmaForecastRequest(new ForecastTimes(publishedAt, ForecastTimesFixture.times(publication, minimum).forecastAt().plusDays(1)), WeatherElement.TMN),
                new KmaForecastRequest(new ForecastTimes(publishedAt, ForecastTimesFixture.times(publication, maximum).forecastAt().plusDays(1)), WeatherElement.TMX));
    }

    @ParameterizedTest
    @ValueSource(strings = {"UTC", "America/Los_Angeles"})
    @ResourceLock("default-time-zone")
    @DisplayName("JVM 기본 시간대와 무관하게 입력 발표시각을 KST로 계획한다")
    void doesNotDependOnJvmTimeZone(final String zone) {
        TimeZone previous = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone(zone));
            WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(DATE.atTime(23, 0));

            assertThat(java.util.stream.Stream.concat(plan.hourlyRequests().stream(), plan.dailyRequests().stream()).toList()).allSatisfy(request -> assertThat(request.tmfc()).isEqualTo("2026102223"));
            assertThat(plan.hourlyRequests().getFirst().tmef()).isEqualTo("2026102300");
            assertThat(plan.hourlyRequests().getLast().tmef()).isEqualTo("2026102423");
            assertThat(plan.dailyRequests()).extracting(request -> request.tmef())
                    .containsExactly("2026102306", "2026102315", "2026102406", "2026102415");
        } finally {
            TimeZone.setDefault(previous);
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 15, 16, 18, 19, 21, 22})
    @DisplayName("단기예보 발표시각이 아닌 정시를 거부한다")
    void rejectsUnsupportedPublicationHours(final int hour) {
        assertThatThrownBy(() -> WeatherCollectionPlan.forPublication(DATE.atTime(hour, 0)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("발표시각 누락이나 분·초·나노초를 자동 보정하지 않고 거부한다")
    void rejectsMissingAndSubHourPublication() {
        LocalDateTime publishedAt = DATE.atTime(17, 0);

        assertThatThrownBy(() -> WeatherCollectionPlan.forPublication(null)).isInstanceOf(IllegalArgumentException.class);
        for (LocalDateTime invalid : List.of(publishedAt.plusMinutes(1), publishedAt.plusSeconds(1), publishedAt.plusNanos(1))) {
            assertThatThrownBy(() -> WeatherCollectionPlan.forPublication(invalid))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    @DisplayName("계획의 요청 목록을 외부에서 변경할 수 없다")
    void keepsPlanImmutable() {
        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(DATE.atTime(17, 0));

        assertThatThrownBy(() -> plan.hourlyRequests().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> plan.dailyRequests().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

}
