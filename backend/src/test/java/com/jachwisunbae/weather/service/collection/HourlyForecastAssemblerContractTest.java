package com.jachwisunbae.weather.service.collection;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.KmaGridParser;
import com.jachwisunbae.weather.support.ForecastTimesFixture;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class HourlyForecastAssemblerContractTest {

    @Test
    @DisplayName("실제 RAW 발췌값을 파싱해 결합하면 공통 샘플 격자의 8개 원본 값과 시각이 보존된다")
    void assemblesParsedSampleCells() throws IOException {
        List<GridForecast> forecasts = readSampleForecasts();
        ForecastTimes times = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 17, 0),
                LocalDateTime.of(2026, 10, 22, 20, 0));
        LocalDateTime collectedAt = LocalDateTime.of(2026, 10, 22, 17, 15);

        List<HourlyForecast> result = new HourlyForecastAssembler().assemble(times, forecasts, collectedAt);

        assertThat(result).extracting(HourlyForecast::point).containsExactly(
                new GridPoint(28, 7), new GridPoint(60, 127), new GridPoint(79, 150), new GridPoint(91, 213));
        assertThat(result).extracting(HourlyForecast::tmp).containsExactly(20.0, 10.0, 0.0, -7.0);
        assertThat(result).contains(new HourlyForecast(new GridPoint(60, 127), times,
                10.0, 1.0, 0.0, 0.0, 0.0, 0.0, 65.0, 0.7, collectedAt));
    }

    private List<GridForecast> readSampleForecasts() throws IOException {
        try (Reader reader = new InputStreamReader(Objects.requireNonNull(
                getClass().getResourceAsStream("/weather/kma-grid-samples.csv")), StandardCharsets.UTF_8);
                CSVParser csv = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).get().parse(reader)) {
            List<CSVRecord> records = csv.getRecords();
            List<GridForecast> forecasts = new ArrayList<>();
            for (WeatherElement element : WeatherElement.hourlyElements()) {
                List<CSVRecord> cells = records.stream().filter(row -> row.get("element").equals(element.name())).toList();
                String[] tokens = new String[GridPoint.CELL_COUNT];
                // 발췌하지 않은 좌표의 결측은 합성값이며 실제 전체 RAW의 결측 분포를 뜻하지 않는다.
                Arrays.fill(tokens, "-99.00");
                cells.forEach(cell -> tokens[Integer.parseInt(cell.get("index"))] = cell.get("raw_value"));
                CSVRecord first = cells.getFirst();
                ForecastTimes times = ForecastTimesFixture.times(first.get("tmfc"), first.get("tmef"));
                forecasts.add(new KmaGridParser().parse(String.join(",", tokens), times, element));
            }
            return forecasts;
        }
    }
}
