package com.jachwisunbae.map.provider;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.map.provider.database.DatabaseBusStopProvider;
import com.jachwisunbae.map.provider.demo.DemoAddressProvider;
import com.jachwisunbae.map.provider.demo.DemoNearbyPlaceProvider;
import com.jachwisunbae.map.provider.kakao.KakaoNearbyPlaceProvider;
import com.jachwisunbae.map.provider.kakao.KakaoPlaceClient;
import com.jachwisunbae.map.provider.publicdata.PublicDataAddressProvider;
import com.jachwisunbae.map.provider.publicdata.juso.JusoAddressClient;
import com.jachwisunbae.map.provider.publicdata.sgis.SgisAddressClient;
import com.jachwisunbae.map.provider.publicdata.sgis.SgisAuthClient;
import com.jachwisunbae.map.provider.publicdata.sgis.SgisTokenProvider;
import com.jachwisunbae.map.repository.BusStopRepository;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.StandardEnvironment;

class MapProviderSelectionTest {

    // 로컬 .env를 불러온 셸의 환경변수(MAP_PROVIDER_MODE 등)가 설정으로 섞이지 않게 제외한다.
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withInitializer(context -> context.getEnvironment().getPropertySources()
                    .remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME))
            .withBean(Clock.class, Clock::systemUTC)
            .withBean(BusStopRepository.class, () -> bounds -> List.of())
            .withUserConfiguration(DemoAddressProvider.class, DemoNearbyPlaceProvider.class,
                    JusoAddressClient.class, SgisAuthClient.class, SgisTokenProvider.class, SgisAddressClient.class,
                    PublicDataAddressProvider.class, KakaoPlaceClient.class, KakaoNearbyPlaceProvider.class,
                    DatabaseBusStopProvider.class);

    @Test
    @DisplayName("설정이 없으면 주소와 주변 시설 모두 demo 공급자를 사용한다")
    void usesDemoProvidersWhenModeIsMissing() {
        contextRunner.run(context -> {
            assertThat(context).getBean(AddressProvider.class).isInstanceOf(DemoAddressProvider.class);
            assertThat(context).getBean(NearbyPlaceProvider.class).isInstanceOf(DemoNearbyPlaceProvider.class);
        });
    }

    @Test
    @DisplayName("버스정류장은 설정과 관계없이 서비스 DB에서 조회한다")
    void alwaysUsesDatabaseBusStopProvider() {
        contextRunner.run(context ->
                assertThat(context).getBean(BusStopProvider.class).isInstanceOf(DatabaseBusStopProvider.class));
        contextRunner
                .withPropertyValues("map.nearby.provider=kakao", "map.kakao.rest-api-key=kakao-key")
                .run(context ->
                        assertThat(context).getBean(BusStopProvider.class).isInstanceOf(DatabaseBusStopProvider.class));
    }

    @Test
    @DisplayName("주소 공급자와 주변 시설 공급자를 각각 선택한다")
    void selectsAddressAndNearbyProvidersIndependently() {
        contextRunner
                .withPropertyValues(
                        "map.provider.mode=public",
                        "map.juso.confirm-key=juso-key",
                        "map.sgis.consumer-key=sgis-key",
                        "map.sgis.consumer-secret=sgis-secret",
                        "map.nearby.provider=kakao",
                        "map.kakao.rest-api-key=kakao-key")
                .run(context -> {
                    assertThat(context).getBean(AddressProvider.class).isInstanceOf(PublicDataAddressProvider.class);
                    assertThat(context).getBean(NearbyPlaceProvider.class).isInstanceOf(KakaoNearbyPlaceProvider.class);
                });
    }

    @Test
    @DisplayName("주소 공급자만 public으로 바꾸면 주변 시설은 demo 공급자를 사용한다")
    void keepsDemoNearbyProviderWhenOnlyAddressProviderIsPublic() {
        contextRunner
                .withPropertyValues(
                        "map.provider.mode=public",
                        "map.juso.confirm-key=juso-key",
                        "map.sgis.consumer-key=sgis-key",
                        "map.sgis.consumer-secret=sgis-secret")
                .run(context -> {
                    assertThat(context).getBean(AddressProvider.class).isInstanceOf(PublicDataAddressProvider.class);
                    assertThat(context).getBean(NearbyPlaceProvider.class).isInstanceOf(DemoNearbyPlaceProvider.class);
                });
    }

    @Test
    @DisplayName("public 모드에 공공데이터 키가 없으면 애플리케이션이 시작되지 않는다")
    void failsToStartWithoutPublicDataKeys() {
        contextRunner
                .withPropertyValues("map.provider.mode=public", "map.juso.confirm-key=",
                        "map.sgis.consumer-key=", "map.sgis.consumer-secret=")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    @DisplayName("kakao 주변 시설 모드에 키가 없으면 애플리케이션이 시작되지 않는다")
    void failsToStartWithoutKakaoKey() {
        contextRunner
                .withPropertyValues("map.nearby.provider=kakao", "map.kakao.rest-api-key=")
                .run(context -> assertThat(context).hasFailed());
    }
}
