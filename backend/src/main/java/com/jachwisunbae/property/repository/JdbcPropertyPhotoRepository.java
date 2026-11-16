package com.jachwisunbae.property.repository;

import com.jachwisunbae.common.exception.client.ClientException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.property.entity.photo.PropertyPhoto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.sql.PreparedStatement;
import java.sql.Statement;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;

@Repository
public class JdbcPropertyPhotoRepository implements PropertyPhotoRepository {

    private final JdbcTemplate jdbcTemplate;
    // DB에 저장된 사진이 사진 규칙(지원 형식 등)을 만족하지 않는 것은 사용자 요청이 아니라 서버 데이터 문제다.
    private final RowMapper<PropertyPhoto> propertyPhotoRowMapper = (rs, row) -> {
        long photoId = rs.getLong("id");
        try {
            return PropertyPhoto.reconstruct(
                    photoId, rs.getLong("property_id"),
                    rs.getString("storage_key"),
                    rs.getString("thumbnail_storage_key"),
                    rs.getString("content_type"),
                    rs.getLong("size_bytes"),
                    rs.getTimestamp("created_at").toLocalDateTime());
        } catch (ClientException exception) {
            throw new DataInconsistencyException(ErrorCode.INTERNAL_SERVER_ERROR,
                    "photoId=" + photoId + " 저장된 사진 데이터가 사진 규칙을 만족하지 않습니다.", exception);
        }
    };

    public JdbcPropertyPhotoRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<PropertyPhoto> findByPropertyId(final long propertyId) {
        String sql = """
                SELECT id, property_id, storage_key, thumbnail_storage_key, content_type, size_bytes, created_at
                FROM property_photos
                WHERE property_id = ?
                ORDER BY created_at ASC, id ASC
                """;
        return jdbcTemplate.query(sql, propertyPhotoRowMapper, propertyId);
    }

    @Override
    public int countByPropertyId(final long propertyId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM property_photos WHERE property_id = ?", Integer.class, propertyId);
        return count == null ? 0 : count;
    }

    @Override
    public PropertyPhoto save(final long memberId, final PropertyPhoto photo) {
        String sql = "INSERT INTO property_photos "
                + "(property_id, member_id, storage_key, thumbnail_storage_key, content_type, size_bytes, created_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?)";
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, photo.getPropertyId());
            statement.setLong(2, memberId);
            statement.setString(3, photo.getStorageKey());
            statement.setString(4, photo.getThumbnailStorageKey());
            statement.setString(5, photo.getContentType());
            statement.setLong(6, photo.getSizeBytes());
            statement.setObject(7, photo.getCreatedAt());
            return statement;
        }, keyHolder);
        return PropertyPhoto.reconstruct(keyHolder.getKey().longValue(), photo.getPropertyId(), photo.getStorageKey(),
                photo.getThumbnailStorageKey(), photo.getContentType(), photo.getSizeBytes(), photo.getCreatedAt());
    }

    @Override
    public Optional<PropertyPhoto> findByIdAndPropertyId(final long photoId, final long propertyId) {
        return jdbcTemplate.query("""
                SELECT id, property_id, storage_key, thumbnail_storage_key, content_type, size_bytes, created_at
                FROM property_photos WHERE id = ? AND property_id = ?
                """, propertyPhotoRowMapper, photoId, propertyId).stream().findFirst();
    }

    @Override
    public void deleteById(final long photoId) {
        jdbcTemplate.update("DELETE FROM main_property_photos WHERE property_photos_id = ?", photoId);
        jdbcTemplate.update("DELETE FROM property_photos WHERE id = ?", photoId);
    }

    @Override
    public void deleteByPropertyId(final long propertyId) {
        jdbcTemplate.update("DELETE FROM main_property_photos WHERE property_id = ?", propertyId);
        jdbcTemplate.update("DELETE FROM property_photos WHERE property_id = ?", propertyId);
    }

    @Override
    public void ensureRepresentative(final long propertyId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM main_property_photos WHERE property_id = ?", Integer.class, propertyId);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.query("SELECT id FROM property_photos WHERE property_id = ? "
                        + "ORDER BY created_at ASC, id ASC LIMIT 1",
                (rs, row) -> rs.getLong("id"), propertyId).stream().findFirst()
                .ifPresent(photoId -> jdbcTemplate.update(
                        "INSERT INTO main_property_photos (property_id, property_photos_id) VALUES (?, ?)",
                        propertyId, photoId));
    }

    @Override
    public Optional<Long> findRepresentativePhotoId(final long propertyId) {
        return jdbcTemplate.query("SELECT property_photos_id FROM main_property_photos WHERE property_id = ?",
                (rs, row) -> rs.getLong("property_photos_id"), propertyId).stream().findFirst();
    }

    @Override
    public void setRepresentative(final long propertyId, final long photoId) {
        jdbcTemplate.update("DELETE FROM main_property_photos WHERE property_id = ?", propertyId);
        jdbcTemplate.update("INSERT INTO main_property_photos (property_id, property_photos_id) VALUES (?, ?)",
                propertyId, photoId);
    }

    // 썸네일이 없는 사진을 ID 순서로 나눠 읽는다. 썸네일을 만들 수 없는 사진(HEIC)도 계속 NULL이므로,
    // 같은 사진을 반복해서 읽지 않도록 마지막으로 처리한 ID 다음부터 읽는다. 탈퇴로 지워진 사진은 제외한다.
    @Override
    public List<PropertyPhoto> findWithoutThumbnailAfter(final long afterPhotoId, final int limit) {
        return jdbcTemplate.query("""
                SELECT id, property_id, storage_key, thumbnail_storage_key, content_type, size_bytes, created_at
                FROM property_photos
                WHERE id > ? AND thumbnail_storage_key IS NULL AND deleted_at IS NULL
                ORDER BY id ASC
                LIMIT ?
                """, propertyPhotoRowMapper, afterPhotoId, limit);
    }

    // 그사이 사진이 지워졌거나 다른 요청이 먼저 썸네일을 기록했으면 바꾸지 않고 false를 돌려준다.
    @Override
    public boolean updateThumbnailStorageKey(final long photoId, final String thumbnailStorageKey) {
        return jdbcTemplate.update("""
                UPDATE property_photos SET thumbnail_storage_key = ?
                WHERE id = ? AND thumbnail_storage_key IS NULL AND deleted_at IS NULL
                """, thumbnailStorageKey, photoId) == 1;
    }
}
