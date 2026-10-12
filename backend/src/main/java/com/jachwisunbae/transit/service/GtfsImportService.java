package com.jachwisunbae.transit.service;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.collection.AdminDongLocator;
import com.jachwisunbae.transit.provider.gtfs.GtfsFeedReader;
import com.jachwisunbae.transit.repository.AdminDongRepository;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
import com.jachwisunbae.transit.service.dto.result.GtfsImportResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GtfsImportService {

    private final String directory;
    private final GtfsFeedReader feedReader;
    private final GtfsNetworkRepository networkRepository;
    private final AdminDongRepository adminDongRepository;

    public GtfsImportService(@Value("${transit.gtfs.directory:}") final String directory,
                             final GtfsFeedReader feedReader,
                             final GtfsNetworkRepository networkRepository,
                             final AdminDongRepository adminDongRepository) {
        this.directory = directory;
        this.feedReader = feedReader;
        this.networkRepository = networkRepository;
        this.adminDongRepository = adminDongRepository;
    }

    // 파일을 모두 읽은 뒤 기존 노선망 삭제와 새 노선망 저장을 한 트랜잭션으로 처리한다.
    // 읽기나 저장 중 실패하면 롤백되어 이전 노선망이 그대로 남는다.
    // 행정동 경계가 이미 적재되어 있으면 정류장마다 행정동 코드를 붙여 저장한다.
    @Transactional
    public GtfsImportResult importFeed() {
        GtfsFeed feed = withAdminDongs(feedReader.read(feedDirectory()));
        networkRepository.replace(feed);
        return new GtfsImportResult(feed.routes().size(), feed.stops().size(),
                feed.edges().size(), feed.transfers().size(), matchedCount(feed.stops()));
    }

    private GtfsFeed withAdminDongs(final GtfsFeed feed) {
        List<AdminDong> adminDongs = adminDongRepository.findAll();
        if (adminDongs.isEmpty()) {
            return feed;
        }
        List<GtfsStop> stops = new AdminDongLocator(adminDongs).assignTo(feed.stops());
        return new GtfsFeed(feed.routes(), stops, feed.edges(), feed.transfers());
    }

    private static int matchedCount(final List<GtfsStop> stops) {
        return (int) stops.stream().filter(stop -> stop.adminDongCode() != null).count();
    }

    // 빈 경로는 Path.of("")가 현재 디렉터리를 가리켜 디렉터리 검사를 통과하므로 따로 막는다.
    private Path feedDirectory() {
        if (directory.isBlank() || !Files.isDirectory(Path.of(directory))) {
            throw new IllegalStateException("GTFS 파일이 있는 디렉터리가 아닙니다: " + directory);
        }
        return Path.of(directory);
    }
}
