package com.jachwisunbae.transit.service.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

class TransitNetworkLoaderTest {

    @Test
    @DisplayName("노선망을 DB에서 읽을 때만 읽기 트랜잭션을 열고, 탐색과 경로 계산은 트랜잭션 없이 한다")
    void opensTransactionOnlyWhenLoading() throws Exception {
        Transactional loading = TransitNetworkLoader.class.getMethod("load").getAnnotation(Transactional.class);

        assertThat(loading).isNotNull();
        assertThat(loading.readOnly()).isTrue();
        assertThat(transactionalMethods(CommuteAreaService.class)).isEmpty();
        assertThat(transactionalMethods(CommuteRouteService.class)).isEmpty();
        assertThat(CommuteAreaService.class.getAnnotation(Transactional.class)).isNull();
        assertThat(CommuteRouteService.class.getAnnotation(Transactional.class)).isNull();
    }

    private static Method[] transactionalMethods(final Class<?> type) {
        return Arrays.stream(type.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(Transactional.class))
                .toArray(Method[]::new);
    }
}
