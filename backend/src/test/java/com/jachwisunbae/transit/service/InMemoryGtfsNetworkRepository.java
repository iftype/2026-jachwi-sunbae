package com.jachwisunbae.transit.service;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.repository.GtfsNetworkRepository;
import java.util.ArrayList;
import java.util.List;

class InMemoryGtfsNetworkRepository implements GtfsNetworkRepository {

    final List<GtfsFeed> replacedFeeds = new ArrayList<>();
    private List<GtfsStop> stops = List.of();
    private List<GtfsRoute> routes = List.of();
    private List<GtfsEdge> edges = List.of();
    private List<GtfsTransfer> transfers = List.of();

    InMemoryGtfsNetworkRepository withStops(final List<GtfsStop> savedStops) {
        stops = savedStops;
        return this;
    }

    @Override
    public void replace(final GtfsFeed feed) {
        replacedFeeds.add(feed);
        stops = feed.stops();
        routes = feed.routes();
        edges = feed.edges();
        transfers = feed.transfers();
    }

    @Override
    public List<GtfsStop> findStops() {
        return stops;
    }

    @Override
    public List<GtfsRoute> findRoutes() {
        return routes;
    }

    @Override
    public List<GtfsEdge> findEdges() {
        return edges;
    }

    @Override
    public List<GtfsTransfer> findTransfers() {
        return transfers;
    }

    @Override
    public void updateAdminDongCodes(final List<GtfsStop> updatedStops) {
        stops = updatedStops;
    }

    List<GtfsStop> stops() {
        return stops;
    }
}
