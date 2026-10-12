package com.jachwisunbae.transit.repository;

import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsStop;
import java.util.List;

public interface GtfsNetworkRepository {

    void replace(GtfsFeed feed);

    List<GtfsStop> findStops();

    void updateAdminDongCodes(List<GtfsStop> stops);
}
