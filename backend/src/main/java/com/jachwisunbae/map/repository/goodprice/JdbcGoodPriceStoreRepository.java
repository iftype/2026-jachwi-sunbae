package com.jachwisunbae.map.repository.goodprice;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.goodprice.GoodPriceMenu;
import com.jachwisunbae.map.domain.goodprice.GoodPriceStore;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcGoodPriceStoreRepository implements GoodPriceStoreRepository {

    private static final int MENU_COUNT = 4;

    private final JdbcTemplate jdbcTemplate;

    public JdbcGoodPriceStoreRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<GoodPriceStore> findAllWithin(CoordinateBounds bounds) {
        String sql = """
                SELECT id, province, district, business_type, name, phone, address, latitude, longitude,
                       menu_name_1, menu_price_1, menu_name_2, menu_price_2,
                       menu_name_3, menu_price_3, menu_name_4, menu_price_4, source_date
                FROM good_price_stores
                WHERE latitude BETWEEN ? AND ?
                  AND longitude BETWEEN ? AND ?
                """;
        return jdbcTemplate.query(sql, goodPriceStoreRowMapper(),
                bounds.getMinLatitude(), bounds.getMaxLatitude(), bounds.getMinLongitude(), bounds.getMaxLongitude());
    }

    // DB에 저장된 값이 업소 규칙(필수 값, 좌표 범위)을 만족하지 않는 것은 적재 데이터 문제다.
    private RowMapper<GoodPriceStore> goodPriceStoreRowMapper() {
        return (resultSet, rowNumber) -> {
            long id = resultSet.getLong("id");
            try {
                return GoodPriceStore.reconstruct(
                        id,
                        resultSet.getString("province"),
                        resultSet.getString("district"),
                        resultSet.getString("business_type"),
                        resultSet.getString("name"),
                        resultSet.getString("phone"),
                        resultSet.getString("address"),
                        resultSet.getBigDecimal("latitude"),
                        resultSet.getBigDecimal("longitude"),
                        menus(resultSet),
                        resultSet.getDate("source_date").toLocalDate()
                );
            } catch (IllegalArgumentException exception) {
                throw new DataInconsistencyException(ErrorCode.INTERNAL_SERVER_ERROR,
                        "goodPriceStoreId=" + id + " 저장된 착한가격업소 데이터가 업소 규칙을 만족하지 않습니다.", exception);
            }
        };
    }

    // 메뉴1~4 컬럼을 순서대로 메뉴 목록으로 바꾼다. 메뉴명이 없는 칸은 건너뛴다.
    private List<GoodPriceMenu> menus(ResultSet resultSet) throws SQLException {
        List<GoodPriceMenu> menus = new ArrayList<>();
        for (int index = 1; index <= MENU_COUNT; index++) {
            GoodPriceMenu.of(resultSet.getString("menu_name_" + index), resultSet.getString("menu_price_" + index))
                    .ifPresent(menus::add);
        }
        return menus;
    }
}
