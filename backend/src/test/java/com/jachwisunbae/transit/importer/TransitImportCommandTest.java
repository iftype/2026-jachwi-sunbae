package com.jachwisunbae.transit.importer;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.jachwisunbae.transit.service.AdminDongImportService;
import com.jachwisunbae.transit.service.GtfsImportService;
import com.jachwisunbae.transit.service.dto.result.GtfsImportResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class TransitImportCommandTest {

    @Test
    @DisplayName("행정동 경계를 적재한 뒤 GTFS 노선망을 적재한다")
    void importsAdminDongsBeforeGtfsNetwork() {
        AdminDongImportService adminDongImportService = mock(AdminDongImportService.class);
        GtfsImportService gtfsImportService = mock(GtfsImportService.class);
        when(adminDongImportService.importBoundaries()).thenReturn(1);
        when(gtfsImportService.importFeed()).thenReturn(new GtfsImportResult(1, 1, 1, 1, 1));

        TransitImportCommand.importTransitData(adminDongImportService, gtfsImportService);

        InOrder order = inOrder(adminDongImportService, gtfsImportService);
        order.verify(adminDongImportService).importBoundaries();
        order.verify(gtfsImportService).importFeed();
    }
}
