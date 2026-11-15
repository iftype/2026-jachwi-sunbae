package com.jachwisunbae.property.repository;

import com.jachwisunbae.checklist.type.CheckStage;
import com.jachwisunbae.property.repository.query.PropertyChecklistProgressQuery;
import com.jachwisunbae.property.repository.query.PropertyProgressSummary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class JdbcPropertyProgressRepository implements PropertyProgressRepository {
    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<PropertyProgressSummary> rowMapper = (rs, row) ->
        new PropertyProgressSummary(
            rs.getLong("property_id"),
            rs.getInt("total_count"),
            rs.getInt("completed_count"),
            rs.getInt("good_count"),
            rs.getInt("caution_count"),
            rs.getInt("unconfirmed_count")
        );

    public JdbcPropertyProgressRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public PropertyProgressSummary findByPropertyId(final long propertyId) {
        String sql = """
                SELECT ? AS property_id, COUNT(pci.id) AS total_count,
                       COALESCE(SUM(pci.status IN ('GOOD', 'CAUTION')), 0) AS completed_count,
                       COALESCE(SUM(pci.status = 'GOOD'), 0) AS good_count,
                       COALESCE(SUM(pci.status = 'CAUTION'), 0) AS caution_count,
                       COALESCE(SUM(pci.status = 'UNCONFIRMED'), 0) AS unconfirmed_count
                FROM property_checklists pc
                LEFT JOIN property_checklist_items pci ON pci.property_checklist_id = pc.id
                WHERE pc.property_id = ? AND pc.stage IN ('ON_SITE', 'PRE_CONTRACT')
                """;
        return jdbcTemplate.queryForObject(sql, rowMapper, propertyId, propertyId);
    }

    @Override
    public List<PropertyChecklistProgressQuery> findByPropertyIdAndStage(final long propertyId) {
        String sql = """
                SELECT pc.stage, pc.id AS property_checklist_id, pc.checklist_name,
                       pc.user_checklist_id AS source_checklist_id,
                       COUNT(pci.id) AS total_count,
                       COALESCE(SUM(pci.status IN ('GOOD', 'CAUTION')), 0) AS completed_count,
                       COALESCE(SUM(pci.status = 'GOOD'), 0) AS good_count,
                       COALESCE(SUM(pci.status = 'CAUTION'), 0) AS caution_count,
                       COALESCE(SUM(pci.status = 'UNCONFIRMED'), 0) AS unconfirmed_count
                FROM property_checklists pc
                LEFT JOIN property_checklist_items pci ON pci.property_checklist_id = pc.id
                WHERE pc.property_id = ? AND pc.stage IN ('ON_SITE', 'PRE_CONTRACT')
                GROUP BY pc.stage, pc.id, pc.checklist_name, pc.user_checklist_id
                ORDER BY CASE pc.stage WHEN 'ON_SITE' THEN 1 WHEN 'PRE_CONTRACT' THEN 2 ELSE 3 END, pc.id ASC
                """;
        return jdbcTemplate.query(sql, (rs, row) -> new PropertyChecklistProgressQuery(
            CheckStage.valueOf(rs.getString("stage")),
            rs.getLong("property_checklist_id"),
            rs.getString("checklist_name"),
            rs.getObject("source_checklist_id", Long.class),
            new PropertyProgressSummary(
                propertyId,
                rs.getInt("total_count"),
                rs.getInt("completed_count"),
                rs.getInt("good_count"),
                rs.getInt("caution_count"),
                rs.getInt("unconfirmed_count")
            )
        ), propertyId);
    }

    @Override
    public List<PropertyChecklistProgressQuery> findByMemberIdAndStage(final long memberId) {
        String sql = """
                SELECT pc.property_id, pc.stage, pc.id AS property_checklist_id, pc.checklist_name,
                       pc.user_checklist_id AS source_checklist_id,
                       COUNT(pci.id) AS total_count,
                       COALESCE(SUM(pci.status IN ('GOOD', 'CAUTION')), 0) AS completed_count,
                       COALESCE(SUM(pci.status = 'GOOD'), 0) AS good_count,
                       COALESCE(SUM(pci.status = 'CAUTION'), 0) AS caution_count,
                       COALESCE(SUM(pci.status = 'UNCONFIRMED'), 0) AS unconfirmed_count
                FROM properties p
                JOIN property_checklists pc ON pc.property_id = p.id
                LEFT JOIN property_checklist_items pci ON pci.property_checklist_id = pc.id
                WHERE p.member_id = ? AND p.deleted_at IS NULL AND pc.stage IN ('ON_SITE', 'PRE_CONTRACT')
                GROUP BY pc.property_id, pc.stage, pc.id, pc.checklist_name, pc.user_checklist_id
                ORDER BY pc.property_id DESC,
                         CASE pc.stage WHEN 'ON_SITE' THEN 1 WHEN 'PRE_CONTRACT' THEN 2 ELSE 3 END, pc.id ASC
                """;
        return jdbcTemplate.query(sql, (rs, row) -> new PropertyChecklistProgressQuery(
            CheckStage.valueOf(rs.getString("stage")),
            rs.getLong("property_checklist_id"),
            rs.getString("checklist_name"),
            rs.getObject("source_checklist_id", Long.class),
            new PropertyProgressSummary(
                rs.getLong("property_id"),
                rs.getInt("total_count"),
                rs.getInt("completed_count"),
                rs.getInt("good_count"),
                rs.getInt("caution_count"),
                rs.getInt("unconfirmed_count")
            )
        ), memberId);
    }
}
