package com.jachwisunbae.map.domain.cctv;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class CctvTest {

    private static final String MANAGEMENT_NUMBER = "202630000000800991";
    private static final String ADDRESS = "경기도 성남시 분당구 판교역로 166";
    private static final BigDecimal LATITUDE = new BigDecimal("37.3951234");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.1121234");

    @Test
    @DisplayName("CCTV를 복원한다")
    void reconstructs() {
        Cctv cctv = Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 2, 200, 30,
                LATITUDE, LONGITUDE);

        assertThat(cctv.getId()).isEqualTo(1L);
        assertThat(cctv.getManagementNumber()).isEqualTo(MANAGEMENT_NUMBER);
        assertThat(cctv.getAddress()).isEqualTo(ADDRESS);
        assertThat(cctv.getPurpose()).isEqualTo(CctvPurpose.CRIME_PREVENTION);
        assertThat(cctv.getCameraCount()).isEqualTo(2);
        assertThat(cctv.getCameraPixels()).isEqualTo(200);
        assertThat(cctv.getRetentionDays()).isEqualTo(30);
        assertThat(cctv.getLatitude()).isEqualByComparingTo(LATITUDE);
        assertThat(cctv.getLongitude()).isEqualByComparingTo(LONGITUDE);
    }

    @Test
    @DisplayName("화소수와 보관일수가 없어도 복원한다")
    void allowsMissingPixelsAndRetentionDays() {
        Cctv cctv = Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1, null, null,
                LATITUDE, LONGITUDE);

        assertThat(cctv.getCameraPixels()).isNull();
        assertThat(cctv.getRetentionDays()).isNull();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = " ")
    @DisplayName("관리번호와 주소가 없으면 복원할 수 없다")
    void requiresText(String value) {
        assertThatThrownBy(() -> Cctv.reconstruct(1L, value, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1, null, null,
                LATITUDE, LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, value, CctvPurpose.CRIME_PREVENTION, 1,
                null, null, LATITUDE, LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("ID와 설치목적이 없으면 복원할 수 없다")
    void requiresIdAndPurpose() {
        assertThatThrownBy(() -> Cctv.reconstruct(null, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION,
                1, null, null, LATITUDE, LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, null, 1, null, null,
                LATITUDE, LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    @DisplayName("카메라 대수가 1보다 작으면 복원할 수 없다")
    void requiresPositiveCameraCount(int cameraCount) {
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION,
                cameraCount, null, null, LATITUDE, LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    @DisplayName("화소수나 보관일수가 있으면서 1보다 작으면 복원할 수 없다")
    void requiresPositivePixelsAndRetentionDays(int value) {
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1,
                value, null, LATITUDE, LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1,
                null, value, LATITUDE, LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("좌표가 없거나 범위를 벗어나면 복원할 수 없다")
    void requiresValidCoordinate() {
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1,
                null, null, null, LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1,
                null, null, LATITUDE, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1,
                null, null, new BigDecimal("90.0000001"), LONGITUDE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1,
                null, null, LATITUDE, new BigDecimal("-180.0000001"))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("기준 좌표에서 CCTV까지의 거리를 계산한다")
    void calculatesDistance() {
        Cctv cctv = Cctv.reconstruct(1L, MANAGEMENT_NUMBER, ADDRESS, CctvPurpose.CRIME_PREVENTION, 1, null, null,
                LATITUDE, LONGITUDE);

        assertThat(cctv.distanceMetersFrom(LATITUDE, LONGITUDE)).isZero();
    }
}
