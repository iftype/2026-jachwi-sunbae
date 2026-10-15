package com.jachwisunbae.transit.service;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.CapitalRegion;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.collection.AdminDongLocator;
import com.jachwisunbae.transit.provider.gtfs.GtfsFeedReader;
import com.jachwisunbae.transit.repository.AdminDongRepository;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
import com.jachwisunbae.transit.service.dto.result.GtfsImportResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
    // 정류장마다 행정동 코드를 붙이고, 수도권(CapitalRegion) 정류장과 그 사이 구간·환승만 저장한다.
    @Transactional
    public GtfsImportResult importFeed() {
        Path feedDirectory = feedDirectory();
        AdminDongLocator locator = adminDongLocator();
        GtfsFeed feed = inCapitalRegion(feedReader.read(feedDirectory), locator);
        networkRepository.replace(feed);
        return new GtfsImportResult(feed.routes().size(), feed.stops().size(),
                feed.edges().size(), feed.transfers().size(), matchedCount(feed.stops()));
    }

    // 정류장이 어느 시도에 있는지 행정동 경계로 판단하므로, 행정동이 먼저 적재되어 있어야 한다.
    // 파일을 읽기 전에 확인해, 큰 GTFS 파일을 다 읽은 뒤에 실패하지 않게 한다.
    private AdminDongLocator adminDongLocator() {
        List<AdminDong> adminDongs = adminDongRepository.findAll();
        if (adminDongs.isEmpty()) {
            throw new IllegalStateException("행정동 경계를 먼저 적재해야 수도권 노선망을 만들 수 있습니다.");
        }
        return new AdminDongLocator(adminDongs);
    }

    private static GtfsFeed inCapitalRegion(final GtfsFeed feed, final AdminDongLocator locator) {
        GtfsFeed assigned = new GtfsFeed(feed.routes(), locator.assignTo(feed.stops()), feed.edges(),
                feed.transfers());
        Set<String> stopIds = capitalStopIds(assigned);
        return assigned.retainStops(stop -> stopIds.contains(stop.stopId()));
    }

    // 수도권 행정동에 든 정류장을 남긴다. 단순화한 경계 사이 틈에 놓여 행정동이 비어 있는 정류장(수도권에 124개)을 빼면
    // 그 정류장을 지나는 노선이 끊기므로, 행정동이 빈 정류장은 남긴 정류장과 구간으로 이어져 있으면 함께 남긴다.
    private static Set<String> capitalStopIds(final GtfsFeed feed) {
        Set<String> stopIds = new HashSet<>();
        Set<String> unknownStopIds = new HashSet<>();
        for (GtfsStop stop : feed.stops()) {
            if (CapitalRegion.includesInNetwork(stop.adminDongCode())) {
                stopIds.add(stop.stopId());
            } else if (stop.adminDongCode() == null) {
                unknownStopIds.add(stop.stopId());
            }
        }
        boolean added = true;
        while (added) {
            added = false;
            for (GtfsEdge edge : feed.edges()) {
                added |= addIfLinked(edge.fromStopId(), edge.toStopId(), stopIds, unknownStopIds);
                added |= addIfLinked(edge.toStopId(), edge.fromStopId(), stopIds, unknownStopIds);
            }
        }
        return stopIds;
    }

    private static boolean addIfLinked(final String stopId, final String linkedStopId, final Set<String> stopIds,
                                       final Set<String> unknownStopIds) {
        if (stopIds.contains(linkedStopId) && unknownStopIds.remove(stopId)) {
            stopIds.add(stopId);
            return true;
        }
        return false;
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
