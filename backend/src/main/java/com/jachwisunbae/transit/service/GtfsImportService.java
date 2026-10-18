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

    // 수도권 행정동에 속한 정류장을 남긴다.
    // 행정동 코드가 없는 정류장은 노선이 끊기지 않도록 수도권 정류장과 연결된 경우 함께 남긴다.
    private static Set<String> capitalStopIds(final GtfsFeed feed) {
        Set<String> capitalStopIds = new HashSet<>();
        Set<String> unknownStopIds = new HashSet<>();

        for (GtfsStop stop : feed.stops()) {
            if (CapitalRegion.includesInNetwork(stop.adminDongCode())) {
                capitalStopIds.add(stop.stopId());
            } else if (stop.adminDongCode() == null) {
                unknownStopIds.add(stop.stopId());
            }
        }

        includeLinkedUnknownStops(feed.edges(), capitalStopIds, unknownStopIds);
        return capitalStopIds;
    }

    // 행정동 코드가 없는 정류장이 연속될 수 있어 더 이상 추가되지 않을 때까지 확인한다.
    private static void includeLinkedUnknownStops(final List<GtfsEdge> edges, final Set<String> capitalStopIds,
                                                  final Set<String> unknownStopIds) {
        boolean added;
        do {
            added = false;
            for (GtfsEdge edge : edges) {
                boolean fromStopAdded = addIfLinked(edge.fromStopId(), edge.toStopId(), capitalStopIds, unknownStopIds);
                boolean toStopAdded = addIfLinked(edge.toStopId(), edge.fromStopId(), capitalStopIds, unknownStopIds);
                added = added || fromStopAdded || toStopAdded;
            }
        } while (added);
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

    private Path feedDirectory() {
        if (directory.isBlank() || !Files.isDirectory(Path.of(directory))) {
            throw new IllegalStateException("GTFS 파일이 있는 디렉터리가 아닙니다: " + directory);
        }
        return Path.of(directory);
    }
}
