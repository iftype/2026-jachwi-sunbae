package com.jachwisunbae.transit.repository;

import com.jachwisunbae.transit.domain.GtfsFeed;

public interface GtfsNetworkRepository {

    void replace(GtfsFeed feed);
}
