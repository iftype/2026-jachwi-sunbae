package com.jachwisunbae.transit.service;

import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
import java.util.ArrayList;
import java.util.List;

class InMemoryGtfsNetworkRepository implements GtfsNetworkRepository {

    final List<GtfsFeed> replacedFeeds = new ArrayList<>();
    private List<GtfsStop> stops = List.of();

    InMemoryGtfsNetworkRepository withStops(final List<GtfsStop> savedStops) {
        stops = savedStops;
        return this;
    }

    @Override
    public void replace(final GtfsFeed feed) {
        replacedFeeds.add(feed);
        stops = feed.stops();
    }

    @Override
    public List<GtfsStop> findStops() {
        return stops;
    }

    @Override
    public void updateAdminDongCodes(final List<GtfsStop> updatedStops) {
        stops = updatedStops;
    }

    List<GtfsStop> stops() {
        return stops;
    }
}
