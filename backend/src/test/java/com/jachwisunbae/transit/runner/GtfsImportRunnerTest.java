package com.jachwisunbae.transit.runner;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.transit.provider.gtfs.GtfsFeedReader;
import com.jachwisunbae.transit.service.GtfsImportService;
import com.jachwisunbae.transit.service.dto.result.GtfsImportResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GtfsImportRunnerTest {

    @Test
    @DisplayName("적재에 성공하면 종료 코드 0을 돌려준다")
    void returnsZeroWhenImportSucceeds() {
        GtfsImportRunner runner = new GtfsImportRunner(importServiceReturning(new GtfsImportResult(1, 2, 3, 4)), null);

        assertThat(runner.importFeed()).isZero();
    }

    @Test
    @DisplayName("적재에 실패하면 종료 코드 1을 돌려준다")
    void returnsOneWhenImportFails() {
        GtfsImportRunner runner = new GtfsImportRunner(new GtfsImportService("", new GtfsFeedReader(), null), null);

        assertThat(runner.importFeed()).isEqualTo(1);
    }

    private GtfsImportService importServiceReturning(final GtfsImportResult result) {
        return new GtfsImportService("", new GtfsFeedReader(), null) {
            @Override
            public GtfsImportResult importFeed() {
                return result;
            }
        };
    }
}
