package com.jachwisunbae.transit.repository;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import java.util.List;

public interface GtfsNetworkRepository {

    void replace(GtfsFeed feed);

    List<GtfsStop> findStops();

    List<GtfsRoute> findRoutes();

    List<GtfsEdge> findEdges();

    List<GtfsTransfer> findTransfers();

    void updateAdminDongCodes(List<GtfsStop> stops);
}
