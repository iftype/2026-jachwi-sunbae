package com.jachwisunbae.weather.provider.kma;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

class KmaGridParserTest {

    private static final ForecastTimes TIMES = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 14, 0),
            LocalDateTime.of(2026, 10, 22, 17, 0));

    private final KmaGridParser parser = new KmaGridParser();

    @Test
    @DisplayName("BOM·줄바꿈·마지막 쉼표를 처리하고 결측 앞뒤의 원래 좌표를 유지한다")
    void preservesCoordinatesAcrossMissingValuesAndRowBoundaries() {
        String[] values = missingGrid();
        values[0] = "-4.00";
        values[1] = "-999.00";
        values[148] = "1.00";
        values[149] = "2.00";
        values[18833] = "14.00";
        values[37696] = "19.00";

        GridForecast result = parser.parse("\uFEFF  " + String.join(",\r\n ", values) + ",\n", TIMES,
                WeatherElement.TMP);

        assertThat(result.times()).isEqualTo(TIMES);
        assertThat(result.element()).isEqualTo(WeatherElement.TMP);
        assertThat(result.values()).hasSize(37697);
        assertThat(result.values()[0]).isEqualTo(-4.0);
        assertThat(result.values()[1]).isNull();
        assertThat(result.values()[148]).isEqualTo(1.0);
        assertThat(result.values()[149]).isEqualTo(2.0);
        assertThat(result.values()[18833]).isEqualTo(14.0);
        assertThat(result.values()[37696]).isEqualTo(19.0);
        assertThat(result.validCount()).isEqualTo(5);
        assertThat(result.missingCount()).isEqualTo(37692);
    }

    @ParameterizedTest
    @EnumSource(value = WeatherElement.class, names = "SKY", mode = EnumSource.Mode.EXCLUDE)
    @DisplayName("정상 0을 결측과 구분하고 마지막 쉼표 없이 파싱한다")
    void preservesZeroAndRequestedElement(final WeatherElement element) {
        String[] values = missingGrid();
        values[0] = "0";
        values[1] = "-999.00";

        GridForecast result = parser.parse(String.join(",", values), TIMES, element);

        assertThat(result.element()).isEqualTo(element);
        assertThat(result.values()[0]).isZero();
        assertThat(result.values()[1]).isNull();
        assertThat(result.validCount()).isEqualTo(1);
        assertThat(result.missingCount()).isEqualTo(37696);
    }

    @ParameterizedTest
    @MethodSource("invalidResponseCases")
    @DisplayName("비어 있거나 격자 개수가 다른 응답은 외부 응답 오류로 구분한다")
    void rejectsEmptyOrWrongSizedResponses(final WeatherElement element, final String raw) {
        assertThatThrownBy(() -> parser.parse(raw, TIMES, element))
                .isInstanceOf(UpstreamServiceException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.WEATHER_RESPONSE_INVALID);
    }

    @ParameterizedTest
    @MethodSource("invalidValueCases")
    @DisplayName("격자 개수가 맞아도 빈 셀·문자·유한하지 않은 숫자는 거부한다")
    void rejectsInvalidValues(final WeatherElement element, final String invalid) {
        String[] values = missingGrid();
        values[0] = "14";
        values[10] = invalid;

        assertThatThrownBy(() -> parser.parse(String.join(",", values), TIMES, element))
                .isInstanceOf(UpstreamServiceException.class).hasMessageContaining("index=10")
                .extracting("errorCode").isEqualTo(ErrorCode.WEATHER_RESPONSE_INVALID);
    }

    @Test
    @DisplayName("파싱 오류에 응답 원문이나 원문이 담긴 원인 예외를 남기지 않는다")
    void hidesRawResponseInErrors() {
        String[] values = missingGrid();
        values[10] = "authKey=test-secret";

        assertThatThrownBy(() -> parser.parse(String.join(",", values), TIMES, WeatherElement.TMP))
                .isInstanceOf(UpstreamServiceException.class)
                .hasMessageNotContaining("test-secret").hasNoCause();
    }

    @ParameterizedTest
    @MethodSource("missingValueCases")
    @DisplayName("전체가 결측인 응답을 정상 수집으로 처리하지 않는다")
    void rejectsAllMissingValues(final WeatherElement element, final String missing) {
        String[] values = new String[149 * 253];
        Arrays.fill(values, missing);

        assertThatThrownBy(() -> parser.parse(String.join(",", values), TIMES, element))
                .isInstanceOf(UpstreamServiceException.class).hasMessageContaining("유효한 값")
                .extracting("errorCode").isEqualTo(ErrorCode.WEATHER_RESPONSE_INVALID);
    }

    @ParameterizedTest
    @EnumSource(WeatherElement.class)
    @DisplayName("과도한 구분자와 잘린 마지막 격자를 거부한다")
    void rejectsExtraDelimitersAndTruncatedGrid(final WeatherElement element) {
        String[] values = missingGrid();
        values[0] = "14";

        assertThatThrownBy(() -> parser.parse(String.join(",", values) + ",,", TIMES, element))
                .isInstanceOf(UpstreamServiceException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.WEATHER_RESPONSE_INVALID);
        assertThatThrownBy(() -> parser.parse(String.join(",", Arrays.copyOf(values, values.length - 1)),
                TIMES, element)).isInstanceOf(UpstreamServiceException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.WEATHER_RESPONSE_INVALID);
    }

    private static Stream<Arguments> invalidResponseCases() {
        return Arrays.stream(WeatherElement.values()).flatMap(element ->
                Stream.of(null, "", " ", "\uFEFF", "<html>API error</html>", "1,2,3")
                        .map(raw -> Arguments.of(element, raw)));
    }

    private static Stream<Arguments> invalidValueCases() {
        return Arrays.stream(WeatherElement.values()).flatMap(element ->
                Stream.of("", "oops", "NaN", "Infinity", "-Infinity", "1e400", "강수없음", "1.0mm")
                        .map(value -> Arguments.of(element, value)));
    }

    private static Stream<Arguments> missingValueCases() {
        return Arrays.stream(WeatherElement.values()).flatMap(element ->
                Stream.of("-99.00", "-999.00").map(value -> Arguments.of(element, value)));
    }

    private String[] missingGrid() {
        String[] values = new String[149 * 253];
        Arrays.fill(values, "-99.00");
        return values;
    }
}
