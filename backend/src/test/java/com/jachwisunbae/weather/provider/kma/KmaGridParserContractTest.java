package com.jachwisunbae.weather.provider.kma;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.support.ForecastTimesFixture;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvFileSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

class KmaGridParserContractTest {

    private static final int CELL_COUNT = 37697;

    private final KmaGridParser parser = new KmaGridParser();

    @ParameterizedTest
    @CsvFileSource(resources = "/weather/kma-precipitation-samples.csv", numLinesToSkip = 1)
    @DisplayName("실제 비·눈 RAW의 정상 0과 양수를 같은 격자·발표·예보시각으로 보존한다")
    void preservesActualPrecipitationSamples(final String scenario, final String publishedAt, final String forecastAt,
            final int nx, final int ny, final double pty, final double pop, final double pcp, final double sno,
            final String expectedRain, final String expectedSnow) {
        ForecastTimes times = ForecastTimesFixture.times(publishedAt, forecastAt);
        GridPoint point = new GridPoint(nx, ny);
        List<WeatherElement> elements = List.of(WeatherElement.PTY, WeatherElement.POP, WeatherElement.PCP, WeatherElement.SNO);
        List<Double> values = List.of(pty, pop, pcp, sno);
        for (int i = 0; i < elements.size(); i++) {
            String[] tokens = new String[CELL_COUNT];
            Arrays.fill(tokens, "-99");
            tokens[(ny - 1) * 149 + nx - 1] = Double.toString(values.get(i));
            GridForecast parsed = parser.parse(formatRaw(tokens), times, elements.get(i));
            assertThat(parsed.times()).isEqualTo(times);
            assertThat(parsed.values()).as(scenario).containsExactly(new GridValue(point, values.get(i)));
        }
    }

    @ParameterizedTest
    @CsvSource({"SKY, 1", "SKY, 3", "SKY, 4", "PTY, 0", "PTY, 1", "PTY, 2", "PTY, 3", "PTY, 4"})
    @DisplayName("공식 SKY·PTY 코드를 숫자 그대로 보존한다")
    void preservesDocumentedCodes(final WeatherElement element, final double code) {
        String[] tokens = new String[CELL_COUNT];
        Arrays.fill(tokens, "-99.00");
        tokens[18833] = Double.toString(code);
        ForecastTimes times = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 17, 0),
                LocalDateTime.of(2026, 10, 22, 20, 0));

        GridForecast result = parser.parse(String.join(",", tokens), times, element);

        assertThat(result.values()).containsExactly(new GridValue(new GridPoint(60, 127), code));
    }

    @ParameterizedTest
    @EnumSource(WeatherElement.class)
    @DisplayName("10개 요소의 실제 RAW 발췌값·좌표·요청 시각을 변환 없이 보존한다")
    void parsesSampleCells(final WeatherElement element) throws IOException {
        List<SampleCell> cells = readSampleCells(element);
        ForecastTimes times = cells.getFirst().times();
        String[] tokens = new String[CELL_COUNT];
        Arrays.fill(tokens, "-99.00");
        cells.forEach(cell -> tokens[cell.index()] = cell.token());

        GridForecast result = parser.parse(formatRaw(tokens), times, element);

        List<GridValue> expected = cells.stream()
                .filter(cell -> !cell.isMissing())
                .map(cell -> new GridValue(new GridPoint(cell.nx(), cell.ny()), cell.value()))
                .toList();
        assertThat(cells).allSatisfy(cell -> assertThat(cell.times()).isEqualTo(times));
        assertThat(result.times()).isEqualTo(times);
        assertThat(result.element()).isEqualTo(element);
        assertThat(result.values()).containsExactlyElementsOf(expected);
        assertThat(result.validCount()).isEqualTo(expected.size());
        assertThat(result.missingCount()).isEqualTo(CELL_COUNT - expected.size());
    }

    @ParameterizedTest
    @EnumSource(WeatherElement.class)
    @DisplayName("유효 격자 수를 특정 샘플 개수로 제한하지 않고 전체가 정상 0인 자료도 허용한다")
    void acceptsFullyPopulatedGrid(final WeatherElement element) throws IOException {
        SampleCell sample = readSampleCells(element).stream()
                .filter(cell -> cell.nx() == 60 && cell.ny() == 127)
                .findFirst().orElseThrow();
        String[] tokens = new String[CELL_COUNT];
        Arrays.fill(tokens, sample.token());

        GridForecast result = parser.parse(String.join(",", tokens), sample.times(), element);

        assertThat(result.validCount()).isEqualTo(CELL_COUNT);
        assertThat(result.missingCount()).isZero();
        assertThat(result.values().getFirst()).isEqualTo(new GridValue(new GridPoint(1, 1), sample.value()));
        assertThat(result.values().getLast()).isEqualTo(new GridValue(new GridPoint(149, 253), sample.value()));
    }

    private List<SampleCell> readSampleCells(final WeatherElement element) throws IOException {
        try (Reader reader = new InputStreamReader(Objects.requireNonNull(
                getClass().getResourceAsStream("/weather/kma-grid-samples.csv")), StandardCharsets.UTF_8);
                CSVParser csv = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).get().parse(reader)) {
            List<SampleCell> cells = csv.getRecords().stream()
                    .filter(row -> row.get("element").equals(element.name()))
                    .map(row -> new SampleCell(ForecastTimesFixture.times(row.get("tmfc"), row.get("tmef")),
                            Integer.parseInt(row.get("index")), Integer.parseInt(row.get("nx")),
                            Integer.parseInt(row.get("ny")), row.get("raw_value")))
                    .toList();
            assertThat(cells).as("%s의 RAW 발췌값", element).isNotEmpty();
            return cells;
        }
    }

    private String formatRaw(final String[] tokens) {
        StringBuilder raw = new StringBuilder("\uFEFF\n");
        for (int index = 0; index < tokens.length; index++) {
            raw.append("  ").append(tokens[index]).append(',');
            // 격자 너비 149와 무관한 위치에서 줄을 바꾼다.
            if ((index + 1) % 19 == 0) {
                raw.append("\r\n");
            }
        }
        return raw.append('\n').toString();
    }

    private record SampleCell(ForecastTimes times, int index, int nx, int ny, String token) {

        double value() {
            return Double.parseDouble(token);
        }

        boolean isMissing() {
            return value() == -99 || value() == -999;
        }
    }
}
