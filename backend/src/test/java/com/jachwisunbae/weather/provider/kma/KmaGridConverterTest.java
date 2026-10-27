package com.jachwisunbae.weather.provider.kma;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.weather.domain.GridPoint;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class KmaGridConverterTest {

    private final KmaGridConverter converter = new KmaGridConverter();

    @ParameterizedTest(name = "{0}")
    @CsvSource({
            "기준점, 38, 126, 43, 136",
            "서울시청, 37.5665, 126.9780, 60, 127",
            "수원시청, 37.2636, 127.0286, 61, 120",
            "부산시청, 35.1796, 129.0756, 98, 76",
            "제주시청, 33.4996, 126.5312, 53, 38",
            "좌측하단, 31.7944, 123.7613, 1, 1",
            "좌측상단, 43.3935, 123.3102, 1, 253",
            "우측상단, 43.2175, 132.7750, 149, 253",
            "우측하단, 31.6518, 131.6423, 149, 1"
    })
    void matchesReferenceGridAndRawIndex(final String region, final double latitude, final double longitude,
                                        final int nx, final int ny) {
        GridPoint point = converter.convert(latitude, longitude);
        assertThat(point).isEqualTo(new GridPoint(nx, ny));
        assertThat(GridPoint.fromIndex((ny - 1) * GridPoint.WIDTH + nx - 1)).isEqualTo(point);
    }

    @Test
    void reusesTheSameGridForNearbyLocations() {
        assertThat(converter.convert(37.5666, 126.9781)).isEqualTo(converter.convert(37.5665, 126.978));
    }

    @ParameterizedTest
    @CsvSource({"NaN,127", "Infinity,127", "37,-Infinity", "90,127", "-90,127", "37,181", "37,-181"})
    void rejectsInvalidCoordinates(final double latitude, final double longitude) {
        assertThatThrownBy(() -> converter.convert(latitude, longitude))
                .isInstanceOfSatisfying(InvalidInputException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(ErrorCode.WEATHER_COORDINATE_INVALID));
    }

    @ParameterizedTest
    @CsvSource({"0,0", "51.5074,-0.1278", "35.6762,139.6503", "31,127", "44,127"})
    void rejectsOutsideGridWithoutClamping(final double latitude, final double longitude) {
        assertThatThrownBy(() -> converter.convert(latitude, longitude))
                .isInstanceOfSatisfying(InvalidInputException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(ErrorCode.WEATHER_LOCATION_UNSUPPORTED));
    }
}
