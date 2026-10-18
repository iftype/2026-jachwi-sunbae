package com.jachwisunbae.transit.service;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.provider.geojson.AdminDongGeoJsonReader;
import com.jachwisunbae.transit.repository.AdminDongRepository;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
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

    public AdminDongImportService(@Value("${transit.admin-dong.file:}") final String file,
                                  final AdminDongGeoJsonReader reader,
                                  final AdminDongRepository adminDongRepository) {
        this.file = file;
        this.reader = reader;
        this.adminDongRepository = adminDongRepository;
    }

    @Transactional
    public int importBoundaries() {
        List<AdminDong> adminDongs = reader.read(boundaryFile());
        adminDongRepository.replace(adminDongs);
        return adminDongs.size();
    }

    private Path boundaryFile() {
        if (file.isBlank() || !Files.isRegularFile(Path.of(file))) {
            throw new IllegalStateException("행정동 경계 GeoJSON 파일이 아닙니다: " + file);
        }
        return Path.of(file);
    }
}
