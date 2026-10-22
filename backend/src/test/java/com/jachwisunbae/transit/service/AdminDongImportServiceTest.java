package com.jachwisunbae.transit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.provider.geojson.AdminDongGeoJsonReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AdminDongImportServiceTest {

    private static final AdminDong OLD_DONG = AdminDongFixture.adminDong("99999999", "옛동", 0, 1, 0, 1);

    @TempDir
    Path directory;

    private final InMemoryAdminDongRepository adminDongRepository = new InMemoryAdminDongRepository(List.of(OLD_DONG));
    private final InMemoryGtfsNetworkRepository networkRepository = new InMemoryGtfsNetworkRepository().withStops(
            List.of(new GtfsStop("S1", "서울역", new Coordinate(37.55, 126.97), "99999999"),
                    new GtfsStop("S2", "부산역", new Coordinate(35.11, 129.04))));

    @Test
    @DisplayName("행정동 경계를 교체한다.")
    void replacesBoundaries() throws IOException {
        AdminDongImportService service = new AdminDongImportService(directory.resolve("admin.geojson").toString(),
                readerReturning(List.of(AdminDongFixture.SEOUL_STATION_DONG)), adminDongRepository);
        Files.writeString(directory.resolve("admin.geojson"), "{}");

        int result = service.importBoundaries();

        assertThat(adminDongRepository.findAll()).containsExactly(AdminDongFixture.SEOUL_STATION_DONG);
        assertThat(result).isEqualTo(1);
    }

    @Test
    @DisplayName("경계 파일 경로가 비어 있거나 파일이 없으면 적재하지 않는다")
    void rejectsMissingFile() {
        AdminDongGeoJsonReader reader = readerReturning(List.of());

        assertThatThrownBy(() -> new AdminDongImportService("", reader, adminDongRepository)
                .importBoundaries())
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new AdminDongImportService(directory.toString(), reader, adminDongRepository).importBoundaries())
                .isInstanceOf(IllegalStateException.class);
        assertThat(adminDongRepository.findAll()).containsExactly(OLD_DONG);
    }

    private AdminDongGeoJsonReader readerReturning(final List<AdminDong> adminDongs) {
        return new AdminDongGeoJsonReader(new ObjectMapper()) {
            @Override
            public List<AdminDong> read(final Path file) {
                return adminDongs;
            }
        };
    }
}
