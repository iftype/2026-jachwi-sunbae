package com.jachwisunbae.transit.repository;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
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

    @Override
    public List<GtfsStop> findStops() {
        return jdbcTemplate.query("""
                SELECT stop_id, stop_name, latitude, longitude, admin_dong_code
                FROM gtfs_stops
                """, (resultSet, rowNumber) -> new GtfsStop(resultSet.getString("stop_id"),
                resultSet.getString("stop_name"),
                new Coordinate(resultSet.getDouble("latitude"), resultSet.getDouble("longitude")),
                resultSet.getString("admin_dong_code")));
    }

    @Override
    public List<GtfsRoute> findRoutes() {
        return jdbcTemplate.query("""
                SELECT route_id, short_name, long_name, route_type, wait_seconds
                FROM gtfs_routes
                """, (resultSet, rowNumber) -> new GtfsRoute(resultSet.getString("route_id"),
                resultSet.getString("short_name"), resultSet.getString("long_name"),
                resultSet.getInt("route_type"), new Seconds(resultSet.getInt("wait_seconds"))));
    }

    @Override
    public List<GtfsEdge> findEdges() {
        return jdbcTemplate.query("""
                SELECT route_id, from_stop_id, to_stop_id, travel_seconds
                FROM gtfs_edges
                """, (resultSet, rowNumber) -> new GtfsEdge(resultSet.getString("route_id"),
                resultSet.getString("from_stop_id"), resultSet.getString("to_stop_id"),
                new Seconds(resultSet.getInt("travel_seconds"))));
    }

    @Override
    public List<GtfsTransfer> findTransfers() {
        return jdbcTemplate.query("""
                SELECT from_stop_id, to_stop_id, transfer_seconds
                FROM gtfs_transfers
                """, (resultSet, rowNumber) -> new GtfsTransfer(resultSet.getString("from_stop_id"),
                resultSet.getString("to_stop_id"), new Seconds(resultSet.getInt("transfer_seconds"))));
    }

    @Override
    public void updateAdminDongCodes(final List<GtfsStop> stops) {
        String sql = "UPDATE gtfs_stops SET admin_dong_code = ? WHERE stop_id = ?";
        jdbcTemplate.batchUpdate(sql, stops, BATCH_SIZE, (statement, stop) -> {
            statement.setString(1, stop.adminDongCode());
            statement.setString(2, stop.stopId());
        });
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
                INSERT INTO gtfs_stops (stop_id, stop_name, latitude, longitude, admin_dong_code)
                VALUES (?, ?, ?, ?, ?)
                """;
        jdbcTemplate.batchUpdate(sql, stops, BATCH_SIZE, (statement, stop) -> {
            statement.setString(1, stop.stopId());
            statement.setString(2, stop.stopName());
            statement.setDouble(3, stop.coordinate().latitude());
            statement.setDouble(4, stop.coordinate().longitude());
            statement.setString(5, stop.adminDongCode());
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
