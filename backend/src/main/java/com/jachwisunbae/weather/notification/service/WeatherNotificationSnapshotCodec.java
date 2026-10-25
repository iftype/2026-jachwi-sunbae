package com.jachwisunbae.weather.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.weather.notification.service.dto.WeatherNotificationSnapshot;
import org.springframework.stereotype.Component;

@Component
public class WeatherNotificationSnapshotCodec {
    private final ObjectMapper mapper;

    public WeatherNotificationSnapshotCodec(final ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public String write(final WeatherNotificationSnapshot snapshot) {
        try {
            return mapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException exception) {
            throw invalidSnapshot();
        }
    }

    public WeatherNotificationSnapshot read(final String json) {
        try {
            return mapper.readValue(json, WeatherNotificationSnapshot.class);
        } catch (JsonProcessingException exception) {
            throw invalidSnapshot();
        }
    }

    private DataInconsistencyException invalidSnapshot() {
        return new DataInconsistencyException(ErrorCode.INTERNAL_SERVER_ERROR, "날씨 알림 스냅샷 변환 실패");
    }
}
