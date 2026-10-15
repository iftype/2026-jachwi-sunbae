package com.jachwisunbae.rental.importer;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

// 데이터 교체 전에 관리자 계정으로 준비한 테이블과 필수 컬럼을 확인한다.
public class RentalSchemaValidator {
    private static final Map<String, String> REQUIRED_COLUMNS = Map.of(
        "legal_dongs", "code, name",
        "rental_datasets", "dataset_key, transaction_sha256, legal_dong_sha256, contract_from, contract_to, "
            + "collected_at, imported_at, row_count",
        "rental_transactions", "id, dataset_key, legal_dong_code, housing_type, deposit_amount_krw, "
            + "monthly_rent_amount_krw, area_m2, contract_date, contract_type, building_name, "
            + "floor, contract_period, source_file, source_row_number"
    );

    public void validate(final JdbcTemplate jdbcTemplate) {
        validateTransactionalTables(jdbcTemplate);
        REQUIRED_COLUMNS.forEach((table, columns) -> validateColumns(jdbcTemplate, table, columns));
    }

    private void validateTransactionalTables(final JdbcTemplate jdbcTemplate) {
        var tables = jdbcTemplate.queryForList("""
            SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND ENGINE = 'InnoDB'
                AND TABLE_NAME IN ('legal_dongs', 'rental_datasets', 'rental_transactions')
            """, String.class);
        if (!tables.containsAll(REQUIRED_COLUMNS.keySet())) {
            throw new IllegalStateException("월세 적재용 InnoDB 테이블이 준비되지 않았습니다. "
                + "관리자 계정으로 Flyway 마이그레이션 적용 여부를 확인해 주세요.");
        }
    }

    private void validateColumns(final JdbcTemplate jdbcTemplate, final String table, final String columns) {
        try {
            jdbcTemplate.queryForList("SELECT " + columns + " FROM " + table + " WHERE 1 = 0");
        } catch (DataAccessException exception) {
            throw new IllegalStateException("월세 적재용 테이블의 필수 컬럼과 SELECT 권한을 확인해 주세요: " + table,
                exception);
        }
    }
}
