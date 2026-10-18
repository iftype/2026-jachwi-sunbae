package com.jachwisunbae.transit.repository;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.importing.GtfsFeed;
import java.util.List;
import java.util.function.Consumer;

public interface GtfsNetworkRepository {

    void replace(GtfsFeed feed);

    List<GtfsStop> findStops();

    List<GtfsRoute> findRoutes();

    // 구간은 117만 개라 목록으로 모으지 않고 읽는 대로 하나씩 넘긴다.
    void forEachEdge(Consumer<GtfsEdge> consumer);

    List<GtfsTransfer> findTransfers();

    void updateAdminDongCodes(List<GtfsStop> stops);
}
