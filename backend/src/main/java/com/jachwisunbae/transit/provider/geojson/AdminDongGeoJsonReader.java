package com.jachwisunbae.transit.provider.geojson;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.transit.domain.AdminDong;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

// 통계청 SGIS 행정동 경계를 변환한 GeoJSON(backend/scripts/admin-dongs)을 읽는다.
// 전국 파일이 수십 MB라 features를 하나씩 읽어 바로 행정동으로 바꾼다.
@Component
public class AdminDongGeoJsonReader {

    private static final DateTimeFormatter BASE_DATE = DateTimeFormatter.BASIC_ISO_DATE;

    private final ObjectMapper objectMapper;

    public AdminDongGeoJsonReader(final ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<AdminDong> read(final Path file) {
        try (JsonParser parser = objectMapper.getFactory().createParser(Files.newInputStream(file))) {
            moveToFeatures(parser, file);
            return readFeatures(parser);
        } catch (IOException exception) {
            throw new InternalSystemException(ErrorCode.ADMIN_DONG_READ_FAILURE,
                    "행정동 경계 파일을 읽지 못했습니다. file=" + file, exception);
        }
    }

    private void moveToFeatures(final JsonParser parser, final Path file) throws IOException {
        if (parser.nextToken() != JsonToken.START_OBJECT) {
            throw failure("GeoJSON FeatureCollection이 아닙니다. file=" + file, null);
        }
        while (parser.nextToken() == JsonToken.FIELD_NAME) {
            String field = parser.currentName();
            parser.nextToken();
            if ("features".equals(field) && parser.currentToken() == JsonToken.START_ARRAY) {
                return;
            }
            parser.skipChildren();
        }
        throw failure("features 배열이 없습니다. file=" + file, null);
    }

    private List<AdminDong> readFeatures(final JsonParser parser) throws IOException {
        List<AdminDong> adminDongs = new ArrayList<>();
        Set<String> codes = new HashSet<>();
        while (parser.nextToken() == JsonToken.START_OBJECT) {
            JsonNode feature = parser.readValueAsTree();
            AdminDong adminDong = toAdminDong(feature, adminDongs.size());
            if (!codes.add(adminDong.code())) {
                throw failure("행정동 코드가 중복됩니다. code=" + adminDong.code(), null);
            }
            adminDongs.add(adminDong);
        }
        return adminDongs;
    }

    private AdminDong toAdminDong(final JsonNode feature, final int index) {
        JsonNode properties = feature.path("properties");
        try {
            return new AdminDong(text(properties, "code"), text(properties, "name"),
                    text(properties, "sidoName"), text(properties, "sigunguName"), text(properties, "fullName"),
                    LocalDate.parse(text(properties, "baseDate"), BASE_DATE),
                    GeoJsonBoundaries.toBoundary(feature.path("geometry")));
        } catch (IllegalArgumentException | DateTimeParseException exception) {
            throw failure("행정동 경계의 값이 올바르지 않습니다. features[" + index + "] code="
                    + properties.path("code").asText() + " " + exception.getMessage(), exception);
        }
    }

    private static String text(final JsonNode properties, final String field) {
        JsonNode value = properties.get(field);
        if (value == null || value.isNull()) {
            throw new IllegalArgumentException(field + " 속성이 없습니다.");
        }
        return value.asText().strip();
    }

    private static InternalSystemException failure(final String message, final Exception cause) {
        return new InternalSystemException(ErrorCode.ADMIN_DONG_READ_FAILURE, message, cause);
    }
}
