package com.jachwisunbae.transit.repository;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcGtfsNetworkRepository implements GtfsNetworkRepository {

    private static final int BATCH_SIZE = 1000;

    private final JdbcTemplate jdbcTemplate;

    public JdbcGtfsNetworkRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // MySQL의 TRUNCATE는 암묵적으로 커밋되고 외래 키가 걸린 테이블에 쓸 수 없어 참조하는 테이블부터 DELETE한다.
    @Override
    public void replace(final GtfsFeed feed) {
        jdbcTemplate.update("DELETE FROM gtfs_transfers");
        jdbcTemplate.update("DELETE FROM gtfs_edges");
        jdbcTemplate.update("DELETE FROM gtfs_stops");
        jdbcTemplate.update("DELETE FROM gtfs_routes");
        insertRoutes(feed.routes());
        insertStops(feed.stops());
        insertEdges(feed.edges());
        insertTransfers(feed.transfers());
    }

    private void insertRoutes(final List<GtfsRoute> routes) {
        String sql = """
                INSERT INTO gtfs_routes (route_id, short_name, long_name, route_type, wait_seconds)
                VALUES (?, ?, ?, ?, ?)
                """;
        jdbcTemplate.batchUpdate(sql, routes, BATCH_SIZE, (statement, route) -> {
            statement.setString(1, route.routeId());
            statement.setString(2, route.shortName());
            statement.setString(3, route.longName());
            statement.setInt(4, route.routeType());
            statement.setInt(5, route.waitTime().value());
        });
    }

    private void insertStops(final List<GtfsStop> stops) {
        String sql = """
                INSERT INTO gtfs_stops (stop_id, stop_name, latitude, longitude)
                VALUES (?, ?, ?, ?)
                """;
        jdbcTemplate.batchUpdate(sql, stops, BATCH_SIZE, (statement, stop) -> {
            statement.setString(1, stop.stopId());
            statement.setString(2, stop.stopName());
            statement.setDouble(3, stop.coordinate().latitude());
            statement.setDouble(4, stop.coordinate().longitude());
        });
    }

    private void insertEdges(final List<GtfsEdge> edges) {
        String sql = """
                INSERT INTO gtfs_edges (route_id, from_stop_id, to_stop_id, travel_seconds)
                VALUES (?, ?, ?, ?)
                """;
        jdbcTemplate.batchUpdate(sql, edges, BATCH_SIZE, (statement, edge) -> {
            statement.setString(1, edge.routeId());
            statement.setString(2, edge.fromStopId());
            statement.setString(3, edge.toStopId());
            statement.setInt(4, edge.travelTime().value());
        });
    }

    private void insertTransfers(final List<GtfsTransfer> transfers) {
        String sql = """
                INSERT INTO gtfs_transfers (from_stop_id, to_stop_id, transfer_seconds)
                VALUES (?, ?, ?)
                """;
        jdbcTemplate.batchUpdate(sql, transfers, BATCH_SIZE, (statement, transfer) -> {
            statement.setString(1, transfer.fromStopId());
            statement.setString(2, transfer.toStopId());
            statement.setInt(3, transfer.transferTime().value());
        });
    }
}
