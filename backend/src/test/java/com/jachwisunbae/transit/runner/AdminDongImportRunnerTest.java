package com.jachwisunbae.transit.runner;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.transit.provider.geojson.AdminDongGeoJsonReader;
import com.jachwisunbae.transit.service.AdminDongImportService;
import com.jachwisunbae.transit.service.dto.result.AdminDongImportResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AdminDongImportRunnerTest {

    @Test
    @DisplayName("적재에 성공하면 종료 코드 0을 돌려준다")
    void returnsZeroWhenImportSucceeds() {
        AdminDongImportService service = new AdminDongImportService("", reader(), null, null) {
            @Override
            public AdminDongImportResult importBoundaries() {
                return new AdminDongImportResult(3559, 214237, 200000);
            }
        };

        assertThat(new AdminDongImportRunner(service, null).importBoundaries()).isZero();
    }

    @Test
    @DisplayName("적재에 실패하면 종료 코드 1을 돌려준다")
    void returnsOneWhenImportFails() {
        AdminDongImportService service = new AdminDongImportService("", reader(), null, null);

        assertThat(new AdminDongImportRunner(service, null).importBoundaries()).isEqualTo(1);
    }

    private AdminDongGeoJsonReader reader() {
        return new AdminDongGeoJsonReader(new ObjectMapper());
    }
}
