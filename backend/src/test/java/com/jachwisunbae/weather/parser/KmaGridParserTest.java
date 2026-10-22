package com.jachwisunbae.weather.parser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridForecast;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.GridValue;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class KmaGridParserTest {

    private static final ForecastTimes TIMES = ForecastTimes.parse("2026102214", "2026102217");

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
        assertThat(result.values()).containsExactly(
                new GridValue(new GridPoint(1, 1), -4), new GridValue(new GridPoint(149, 1), 1),
                new GridValue(new GridPoint(1, 2), 2), new GridValue(new GridPoint(60, 127), 14),
                new GridValue(new GridPoint(149, 253), 19));
        assertThat(result.validCount()).isEqualTo(5);
        assertThat(result.missingCount()).isEqualTo(37692);
    }

    @Test
    @DisplayName("기온 이외 요소에서도 정상 0을 보존하고 마지막 쉼표 없이 파싱한다")
    void preservesZeroAndRequestedElement() {
        String[] values = missingGrid();
        values[0] = "0";

        GridForecast result = parser.parse(String.join(",", values), TIMES, WeatherElement.PTY);

        assertThat(result.element()).isEqualTo(WeatherElement.PTY);
        assertThat(result.values()).containsExactly(new GridValue(new GridPoint(1, 1), 0));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\uFEFF", "<html>API error</html>", "1,2,3"})
    @DisplayName("비어 있거나 격자 개수가 다른 응답은 외부 응답 오류로 구분한다")
    void rejectsEmptyOrWrongSizedResponses(final String raw) {
        assertThatThrownBy(() -> parser.parse(raw, TIMES, WeatherElement.TMP))
                .isInstanceOf(UpstreamServiceException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.WEATHER_RESPONSE_INVALID);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "oops", "NaN", "Infinity", "-Infinity", "1e400"})
    @DisplayName("격자 개수가 맞아도 빈 셀·문자·유한하지 않은 숫자는 거부한다")
    void rejectsInvalidValues(final String invalid) {
        String[] values = missingGrid();
        values[0] = "14";
        values[10] = invalid;

        assertThatThrownBy(() -> parser.parse(String.join(",", values), TIMES, WeatherElement.TMP))
                .isInstanceOf(UpstreamServiceException.class).hasMessageContaining("index=10");
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
    @ValueSource(strings = {"-99.00", "-999.00"})
    @DisplayName("전체가 결측인 응답을 정상 수집으로 처리하지 않는다")
    void rejectsAllMissingValues(final String missing) {
        String[] values = new String[149 * 253];
        Arrays.fill(values, missing);

        assertThatThrownBy(() -> parser.parse(String.join(",", values), TIMES, WeatherElement.TMP))
                .isInstanceOf(UpstreamServiceException.class).hasMessageContaining("유효한 값");
    }

    @Test
    @DisplayName("과도한 구분자와 잘린 마지막 격자를 거부한다")
    void rejectsExtraDelimitersAndTruncatedGrid() {
        String[] values = missingGrid();
        values[0] = "14";

        assertThatThrownBy(() -> parser.parse(String.join(",", values) + ",,", TIMES, WeatherElement.TMP))
                .isInstanceOf(UpstreamServiceException.class);
        assertThatThrownBy(() -> parser.parse(String.join(",", Arrays.copyOf(values, values.length - 1)),
                TIMES, WeatherElement.TMP)).isInstanceOf(UpstreamServiceException.class);
    }

    private String[] missingGrid() {
        String[] values = new String[149 * 253];
        Arrays.fill(values, "-99.00");
        return values;
    }
}
