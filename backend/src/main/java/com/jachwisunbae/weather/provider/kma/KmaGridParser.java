package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.util.ArrayList;
import java.util.List;

//Raw를 격자 데이터로 변환한다.
// 쉼표로 숫자 분리, 숫자가 37697인지 확인, 원본 인덱스를 (nx,ny)로 변환 , -99,-999 결축값 제외
public class KmaGridParser {

    public GridForecast parse(final String raw, final ForecastTimes times, final WeatherElement element) {
        if (times == null || element == null) {
            throw new IllegalArgumentException("RAW 요청에 사용한 시각과 기상 요소가 필요합니다.");
        }
        if (raw == null || raw.isBlank()) {
            throw invalidResponse("기상청 격자 응답이 비어 있습니다.");
        }

        String text = raw.strip();
        if (text.startsWith("\uFEFF")) {
            text = text.substring(1).strip();
        }
        if (text.endsWith(",")) {
            text = text.substring(0, text.length() - 1);
        }
        String[] tokens = text.split(",", -1);
        if (tokens.length != GridPoint.CELL_COUNT) {
            throw invalidResponse("기상청 격자 수가 일치하지 않습니다. count=" + tokens.length);
        }

        List<GridValue> values = new ArrayList<>();
        for (int index = 0; index < tokens.length; index++) {
            double value = parseValue(tokens[index], index);
            if (value != -99.0 && value != -999.0) {
                // 결측을 제거하기 전의 원본 인덱스로 좌표를 계산한다.
                values.add(new GridValue(GridPoint.fromIndex(index), value));
            }
        }
        if (values.isEmpty()) {
            throw invalidResponse("기상청 격자 응답에 유효한 값이 없습니다.");
        }
        return new GridForecast(times, element, values);
    }

    private double parseValue(final String token, final int index) {
        double value;
        try {
            value = Double.parseDouble(token.strip());
        } catch (NumberFormatException exception) {
            // 오류 본문에 인증키가 있을 수 있어 원문과 원문을 포함하는 cause를 전달하지 않는다.
            throw invalidResponse("기상청 격자 값이 숫자가 아닙니다. index=" + index);
        }
        if (!Double.isFinite(value)) {
            throw invalidResponse("기상청 격자 값이 유한하지 않습니다. index=" + index);
        }
        return value;
    }

    private UpstreamServiceException invalidResponse(final String message) {
        return new UpstreamServiceException(ErrorCode.WEATHER_RESPONSE_INVALID, message);
    }
}
