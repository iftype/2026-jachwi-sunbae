package com.jachwisunbae.property.repository;

import com.jachwisunbae.common.exception.client.ClientException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.repository.query.PropertyListItemQuery;
import com.jachwisunbae.property.repository.query.PropertyLocationQuery;
import com.jachwisunbae.property.type.RoomOption;
import com.jachwisunbae.property.type.UtilityOption;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcPropertyRepository implements PropertyRepository {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<PropertyListItemQuery> propertyListRowMapper = (rs, row) -> new PropertyListItemQuery(
        rs.getLong("id"),
        rs.getString("name"),
        rs.getObject("deposit_amount", Long.class),
        rs.getObject("monthly_rent_amount", Long.class),
        rs.getString("discovery_source"),
        rs.getString("address"),
        rs.getBigDecimal("latitude"),
        rs.getBigDecimal("longitude"),
        rs.getObject("photo_id", Long.class),
        rs.getString("storage_key"),
        rs.getString("content_type"),
        rs.getInt("photo_count"),
        rs.getInt("total_count"),
        rs.getInt("completed_count"),
        rs.getInt("good_count"),
        rs.getInt("caution_count"),
        rs.getInt("unconfirmed_count")
    );

    public JdbcPropertyRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<PropertyListItemQuery> findListByMemberId(final long memberId) {
        String sql = """
                SELECT p.id, p.member_id, p.name, p.deposit_amount, p.monthly_rent_amount,
                       p.address, p.latitude, p.longitude,
                       pd.discovery_source,
                       ph.id AS photo_id, ph.storage_key, ph.content_type,
                       (SELECT COUNT(*) FROM property_photos pph WHERE pph.property_id = p.id AND pph.deleted_at IS NULL) AS photo_count,
                       COALESCE(progress.total_count, 0) AS total_count,
                       COALESCE(progress.completed_count, 0) AS completed_count,
                       COALESCE(progress.good_count, 0) AS good_count,
                       COALESCE(progress.caution_count, 0) AS caution_count,
                       COALESCE(progress.unconfirmed_count, 0) AS unconfirmed_count
                FROM properties p
                LEFT JOIN property_details pd ON pd.property_id = p.id
                LEFT JOIN main_property_photos mp ON mp.property_id = p.id
                LEFT JOIN property_photos ph ON ph.id = mp.property_photos_id AND ph.deleted_at IS NULL
                LEFT JOIN (
                    SELECT pc.property_id, COUNT(pci.id) AS total_count,
                           SUM(pci.status IN ('GOOD', 'CAUTION')) AS completed_count,
                           SUM(pci.status = 'GOOD') AS good_count,
                           SUM(pci.status = 'CAUTION') AS caution_count,
                           SUM(pci.status = 'UNCONFIRMED') AS unconfirmed_count
                    FROM properties owned
                    JOIN property_checklists pc ON pc.property_id = owned.id
                    LEFT JOIN property_checklist_items pci ON pci.property_checklist_id = pc.id
                    WHERE owned.member_id = ? AND owned.deleted_at IS NULL
                    GROUP BY pc.property_id
                ) progress ON progress.property_id = p.id
                WHERE p.member_id = ? AND p.deleted_at IS NULL
                ORDER BY p.id DESC
                """;
        return jdbcTemplate.query(sql, propertyListRowMapper, memberId, memberId);
    }

    @Override
    public List<PropertyLocationQuery> findLocationsByMemberId(final long memberId) {
        return jdbcTemplate.query("""
                SELECT id, name, latitude, longitude
                FROM properties
                WHERE member_id = ? AND deleted_at IS NULL
                ORDER BY id DESC
                """, (rs, row) -> new PropertyLocationQuery(rs.getLong("id"), rs.getString("name"),
                rs.getBigDecimal("latitude"), rs.getBigDecimal("longitude")), memberId);
    }

    @Override
    public int countByMemberId(final long memberId) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM properties WHERE member_id = ? AND deleted_at IS NULL",
            Integer.class, memberId);
        return count == null ? 0 : count;
    }

    @Override
    public Property save(final Property property) {
        String sql = """
                INSERT INTO properties
                    (member_id, name, deposit_amount, monthly_rent_amount,
                     address, latitude, longitude, memo, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, property.getMemberId());
            statement.setString(2, property.getName());
            statement.setObject(3, property.getDepositAmount());
            statement.setObject(4, property.getMonthlyRentAmount());
            statement.setString(5, property.getAddress());
            statement.setBigDecimal(6, property.getLatitude());
            statement.setBigDecimal(7, property.getLongitude());
            statement.setString(8, property.getMemo());
            statement.setObject(9, property.getCreatedAt());
            return statement;
        }, keyHolder);

        long generatedId = keyHolder.getKey().longValue();
        insertPropertyDetails(generatedId, property);
        insertRoomOptions(generatedId, property.getRoomOptions());
        insertUtilityOptions(generatedId, property.getUtilityOptions());

        return Property.reconstruct(
            generatedId,
            property.getMemberId(),
            property.getName(),
            property.getDepositAmount(),
            property.getMonthlyRentAmount(),
            property.getAddress(),
            property.getLatitude(),
            property.getLongitude(),
            property.getAvailableMoveInDate(),
            property.getMaintenanceFeeAmount(),
            property.getVisitScheduledAt(),
            property.getRoomOptions(),
            property.getUtilityOptions(),
            property.getDiscoverySource(),
            property.getMemo(),
            property.getCreatedAt(),
            property.getUpdatedAt()
        );
    }

    @Override
    public Optional<Property> findByIdAndMemberId(final long propertyId, final long memberId) {
        return jdbcTemplate.query(findByIdSql(), this::mapPropertyRow, propertyId, memberId)
            .stream()
            .findFirst();
    }

    @Override
    public boolean existsByIdAndMemberId(final long propertyId, final long memberId) {
        Boolean exists = jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM properties WHERE id = ? AND member_id = ? AND deleted_at IS NULL)",
            Boolean.class, propertyId, memberId);
        return Boolean.TRUE.equals(exists);
    }

    @Override
    public Optional<Property> findByIdAndMemberIdForUpdate(final long propertyId, final long memberId) {
        return jdbcTemplate.query(findByIdSql() + " FOR UPDATE", this::mapPropertyRow, propertyId, memberId)
            .stream()
            .findFirst();
    }

    @Override
    public Property update(final Property property) {
        String sql = """
                UPDATE properties
                SET name = ?, deposit_amount = ?, monthly_rent_amount = ?,
                    address = ?, latitude = ?, longitude = ?
                WHERE id = ? AND member_id = ? AND deleted_at IS NULL
                """;
        jdbcTemplate.update(sql,
            property.getName(),
            property.getDepositAmount(),
            property.getMonthlyRentAmount(),
            property.getAddress(),
            property.getLatitude(),
            property.getLongitude(),
            property.getId(),
            property.getMemberId()
        );
        upsertPropertyDetails(property);
        replaceRoomOptions(property.getId(), property.getRoomOptions());
        replaceUtilityOptions(property.getId(), property.getUtilityOptions());
        return property;
    }

    @Override
    public void updateMemo(final Property property) {
        jdbcTemplate.update("""
                UPDATE properties
                SET memo = ?
                WHERE id = ? AND member_id = ? AND deleted_at IS NULL
                """,
            property.getMemo(),
            property.getId(),
            property.getMemberId()
        );
    }

    @Override
    public void deleteById(final long propertyId) {
        jdbcTemplate.update("UPDATE properties SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", propertyId);
    }

    private String findByIdSql() {
        return """
                SELECT p.id, p.member_id, p.name, p.deposit_amount, p.monthly_rent_amount,
                       p.address, p.latitude, p.longitude, p.memo, p.created_at,
                       pd.discovery_source, pd.available_move_in_date, pd.maintenance_fee_amount,
                       pd.visit_scheduled_at
                FROM properties p
                LEFT JOIN property_details pd ON pd.property_id = p.id
                WHERE p.id = ? AND p.member_id = ? AND p.deleted_at IS NULL
                """;
    }

    private Property mapPropertyRow(final ResultSet rs, final int rowNum) throws SQLException {
        long propertyId = rs.getLong("id");
        Date availableMoveInDate = rs.getDate("available_move_in_date");
        Timestamp visitScheduledAt = rs.getTimestamp("visit_scheduled_at");
        Timestamp createdAt = rs.getTimestamp("created_at");
        try {
            return Property.reconstruct(
                propertyId,
                rs.getLong("member_id"),
                rs.getString("name"),
                rs.getObject("deposit_amount", Long.class),
                rs.getObject("monthly_rent_amount", Long.class),
                rs.getString("address"),
                rs.getBigDecimal("latitude"),
                rs.getBigDecimal("longitude"),
                availableMoveInDate == null ? null : availableMoveInDate.toLocalDate(),
                rs.getObject("maintenance_fee_amount", Long.class),
                visitScheduledAt == null ? null : visitScheduledAt.toLocalDateTime(),
                findRoomOptions(propertyId),
                findUtilityOptions(propertyId),
                rs.getString("discovery_source"),
                rs.getString("memo"),
                createdAt.toLocalDateTime(),
                createdAt.toLocalDateTime()
            );
        } catch (ClientException exception) {
            // DB에 저장된 매물이 입력 규칙을 만족하지 않는 것은 사용자 요청이 아니라 서버 데이터 문제다.
            throw new DataInconsistencyException(ErrorCode.INTERNAL_SERVER_ERROR,
                "propertyId=" + propertyId + " 저장된 매물 데이터가 매물 규칙을 만족하지 않습니다.", exception);
        }
    }

    private void insertPropertyDetails(final long propertyId, final Property property) {
        jdbcTemplate.update("""
                INSERT INTO property_details
                    (property_id, available_move_in_date, maintenance_fee_amount, visit_scheduled_at,
                     discovery_source, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
            propertyId,
            toSqlDate(property.getAvailableMoveInDate()),
            property.getMaintenanceFeeAmount(),
            property.getVisitScheduledAt(),
            property.getDiscoverySource(),
            property.getCreatedAt());
    }

    private void upsertPropertyDetails(final Property property) {
        int updated = jdbcTemplate.update("""
                UPDATE property_details
                SET available_move_in_date = ?, maintenance_fee_amount = ?, visit_scheduled_at = ?,
                    discovery_source = ?
                WHERE property_id = ?
                """,
            toSqlDate(property.getAvailableMoveInDate()),
            property.getMaintenanceFeeAmount(),
            property.getVisitScheduledAt(),
            property.getDiscoverySource(),
            property.getId());
        if (updated == 0) {
            jdbcTemplate.update("""
                    INSERT INTO property_details
                        (property_id, available_move_in_date, maintenance_fee_amount, visit_scheduled_at,
                         discovery_source, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                property.getId(),
                toSqlDate(property.getAvailableMoveInDate()),
                property.getMaintenanceFeeAmount(),
                property.getVisitScheduledAt(),
                property.getDiscoverySource(),
                property.getUpdatedAt());
        }
    }

    private void replaceRoomOptions(final long propertyId, final Set<RoomOption> roomOptions) {
        jdbcTemplate.update("DELETE FROM property_room_options WHERE property_id = ?", propertyId);
        insertRoomOptions(propertyId, roomOptions);
    }

    private void insertRoomOptions(final long propertyId, final Set<RoomOption> roomOptions) {
        if (roomOptions == null || roomOptions.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate("INSERT INTO property_room_options (property_id, option_code) VALUES (?, ?)",
            roomOptions.stream().map(option -> new Object[]{propertyId, option.name()}).toList());
    }

    private void replaceUtilityOptions(final long propertyId, final Set<UtilityOption> utilityOptions) {
        jdbcTemplate.update("DELETE FROM property_utility_options WHERE property_id = ?", propertyId);
        insertUtilityOptions(propertyId, utilityOptions);
    }

    private void insertUtilityOptions(final long propertyId, final Set<UtilityOption> utilityOptions) {
        if (utilityOptions == null || utilityOptions.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate("INSERT INTO property_utility_options (property_id, utility_code) VALUES (?, ?)",
            utilityOptions.stream().map(option -> new Object[]{propertyId, option.name()}).toList());
    }

    private Set<RoomOption> findRoomOptions(final long propertyId) {
        List<String> codes = jdbcTemplate.queryForList(
            "SELECT option_code FROM property_room_options WHERE property_id = ?", String.class, propertyId);
        return codes.stream().map(RoomOption::valueOf).collect(Collectors.toUnmodifiableSet());
    }

    private Set<UtilityOption> findUtilityOptions(final long propertyId) {
        List<String> codes = jdbcTemplate.queryForList(
            "SELECT utility_code FROM property_utility_options WHERE property_id = ?", String.class, propertyId);
        return codes.stream().map(UtilityOption::valueOf).collect(Collectors.toUnmodifiableSet());
    }

    private Date toSqlDate(final LocalDate date) {
        return date == null ? null : Date.valueOf(date);
    }
}
