package com.jachwisunbae.transit.service;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.collection.AdminDongLocator;
import com.jachwisunbae.transit.provider.geojson.AdminDongGeoJsonReader;
import com.jachwisunbae.transit.repository.AdminDongRepository;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
import com.jachwisunbae.transit.service.dto.result.AdminDongImportResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDongImportService {

    private final String file;
    private final AdminDongGeoJsonReader reader;
    private final AdminDongRepository adminDongRepository;
    private final GtfsNetworkRepository networkRepository;

    public AdminDongImportService(@Value("${transit.admin-dong.file:}") final String file,
                                  final AdminDongGeoJsonReader reader,
                                  final AdminDongRepository adminDongRepository,
                                  final GtfsNetworkRepository networkRepository) {
        this.file = file;
        this.reader = reader;
        this.adminDongRepository = adminDongRepository;
        this.networkRepository = networkRepository;
    }

    // 행정동 경계를 모두 교체하고, 이미 적재된 정류장의 행정동 코드를 새 경계로 다시 붙인다.
    // GTFS를 먼저 적재했든 나중에 적재했든 같은 결과가 되도록 양쪽 적재에서 모두 정류장을 매칭한다.
    @Transactional
    public AdminDongImportResult importBoundaries() {
        List<AdminDong> adminDongs = reader.read(boundaryFile());
        adminDongRepository.replace(adminDongs);
        List<GtfsStop> stops = new AdminDongLocator(adminDongs).assignTo(networkRepository.findStops());
        networkRepository.updateAdminDongCodes(stops);
        int matchedStopCount = (int) stops.stream().filter(stop -> stop.adminDongCode() != null).count();
        return new AdminDongImportResult(adminDongs.size(), stops.size(), matchedStopCount);
    }

    private Path boundaryFile() {
        if (file.isBlank() || !Files.isRegularFile(Path.of(file))) {
            throw new IllegalStateException("행정동 경계 GeoJSON 파일이 아닙니다: " + file);
        }
        return Path.of(file);
    }
}
