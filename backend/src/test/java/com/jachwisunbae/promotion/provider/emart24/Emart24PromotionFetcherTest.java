package com.jachwisunbae.promotion.provider.emart24;

import static com.jachwisunbae.promotion.provider.emart24.Emart24PromotionFixtures.emptyPage;
import static com.jachwisunbae.promotion.provider.emart24.Emart24PromotionFixtures.page;
import static com.jachwisunbae.promotion.provider.emart24.Emart24PromotionFixtures.product;
import static com.jachwisunbae.promotion.provider.emart24.Emart24PromotionFixtures.products;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class Emart24PromotionFetcherTest {

    private static final Emart24ProductCategory FIRST_CATEGORY = Emart24ProductCategory.MEAL;

    private final Emart24PromotionClient client = mock(Emart24PromotionClient.class);
    private final Emart24PromotionFetcher fetcher = new Emart24PromotionFetcher(client);

    @Test
    @DisplayName("네 카테고리의 여러 페이지를 첫 페이지부터 마지막까지 수집하고 분류별로 집계한다")
    void collectsAllCategoryPages() {
        for (Emart24ProductCategory category : Emart24ProductCategory.values()) {
            when(client.fetch(category, 1)).thenReturn(page(category, 1, 21, true, products(20, "첫 상품")));
            when(client.fetch(category, 2)).thenReturn(page(category, 2, 21, false, product("마지막 상품")));
        }

        List<PromotionProduct> result = fetcher.fetch();

        assertThat(result).hasSize(84);
        InOrder order = inOrder(client);
        for (Emart24ProductCategory category : Emart24ProductCategory.values()) {
            assertThat(result).filteredOn(product -> product.category() == category.category()).hasSize(21);
            order.verify(client).fetch(category, 1);
            order.verify(client).fetch(category, 2);
        }
        order.verifyNoMoreInteractions();
    }

    @Test
    @DisplayName("마지막 페이지가 꽉 차 있어도 다음 페이지를 요청하지 않는다")
    void stopsOnFullLastPage() {
        for (Emart24ProductCategory category : Emart24ProductCategory.values()) {
            when(client.fetch(category, 1)).thenReturn(page(category, 1, 20, false, products(20, "상품")));
        }

        assertThat(fetcher.fetch()).hasSize(80);
        verifyOnlyFirstPages();
    }

    @Test
    @DisplayName("첫 카테고리가 명시적 빈 결과이면 그 분류를 종료하고 나머지 분류를 수집한다")
    void acceptsConfirmedEmptyFirstPage() {
        for (Emart24ProductCategory category : Emart24ProductCategory.values()) {
            when(client.fetch(category, 1)).thenReturn(category == FIRST_CATEGORY ? emptyPage(category)
                    : page(category, 1, 1, false, product("상품")));
        }

        List<PromotionProduct> result = fetcher.fetch();

        assertThat(result).hasSize(3).noneMatch(product -> product.category() == FIRST_CATEGORY.category());
        verifyOnlyFirstPages();
    }

    @Test
    @DisplayName("첫 페이지에서 카드를 찾지 못해도 총 상품 수가 있으면 빈 결과로 숨기지 않는다")
    void rejectsUnexplainedEmptyFirstPage() {
        when(client.fetch(FIRST_CATEGORY, 1)).thenReturn(page(FIRST_CATEGORY, 1, 1, false));

        assertResponseFailure(fetcher);
        InOrder order = inOrder(client);
        order.verify(client).fetch(FIRST_CATEGORY, 1);
        order.verifyNoMoreInteractions();
    }

    @Test
    @DisplayName("중간 요청이 실패하면 부분 수집 결과나 다음 카테고리를 반환하지 않는다")
    void stopsWhenRequestFails() {
        when(client.fetch(FIRST_CATEGORY, 1))
                .thenReturn(page(FIRST_CATEGORY, 1, 21, true, products(20, "상품")));
        UpstreamServiceException failure = new UpstreamServiceException(ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE,
                "HTTP status=429");
        when(client.fetch(FIRST_CATEGORY, 2)).thenThrow(failure);

        assertThatThrownBy(fetcher::fetch).isSameAs(failure);
        verifyOnlyFirstCategoryTwoPages();
    }

    @Test
    @DisplayName("중간 페이지의 상품 파싱이 실패하면 수집 전체를 중단한다")
    void stopsWhenMiddlePageCannotBeParsed() {
        when(client.fetch(FIRST_CATEGORY, 1))
                .thenReturn(page(FIRST_CATEGORY, 1, 21, true, products(20, "상품")));
        when(client.fetch(FIRST_CATEGORY, 2)).thenReturn(page(FIRST_CATEGORY, 2, 21, false,
                product("깨진 상품").replace("class=\"price\"", "class=\"changed\"")));

        assertResponseFailure(fetcher);
        verifyOnlyFirstCategoryTwoPages();
    }

    @Test
    @DisplayName("최대 페이지에 도달해도 다음 페이지가 있으면 성공으로 처리하지 않는다")
    void failsAtPageLimit() {
        when(client.fetch(FIRST_CATEGORY, 1))
                .thenReturn(page(FIRST_CATEGORY, 1, 60, true, products(20, "앞 상품")));
        when(client.fetch(FIRST_CATEGORY, 2))
                .thenReturn(page(FIRST_CATEGORY, 2, 60, true, products(20, "뒤 상품")));

        assertThatThrownBy(() -> new Emart24PromotionFetcher(client, 2).fetch())
                .isInstanceOf(UpstreamServiceException.class).hasMessageContaining("최대 수집 페이지");
        verifyOnlyFirstCategoryTwoPages();
    }

    @Test
    @DisplayName("수집 중 전체 상품 수가 바뀌면 불완전한 스냅샷을 성공으로 처리하지 않는다")
    void rejectsChangedTotalCount() {
        when(client.fetch(FIRST_CATEGORY, 1))
                .thenReturn(page(FIRST_CATEGORY, 1, 21, true, products(20, "앞 상품")));
        when(client.fetch(FIRST_CATEGORY, 2))
                .thenReturn(page(FIRST_CATEGORY, 2, 22, false, products(2, "뒤 상품")));

        assertThatThrownBy(fetcher::fetch).isInstanceOf(UpstreamServiceException.class)
                .hasMessageContaining("전체 상품 수가 달라졌습니다");
        verifyOnlyFirstCategoryTwoPages();
    }

    @Test
    @DisplayName("페이지 크기가 바뀌어 누적 상품 수가 달라지면 전체 수집 성공으로 처리하지 않는다")
    void rejectsChangedPageSize() {
        when(client.fetch(FIRST_CATEGORY, 1))
                .thenReturn(page(FIRST_CATEGORY, 1, 21, true, products(20, "앞 상품")));
        when(client.fetch(FIRST_CATEGORY, 2)).thenReturn(page(FIRST_CATEGORY, 2, 21, true, products(10, "중간 상품"))
                .replace("const pageLength = \"20\";", "const pageLength = \"10\";"));
        when(client.fetch(FIRST_CATEGORY, 3)).thenReturn(page(FIRST_CATEGORY, 3, 21, false, product("마지막 상품"))
                .replace("const pageLength = \"20\";", "const pageLength = \"10\";"));

        assertThatThrownBy(fetcher::fetch).isInstanceOf(UpstreamServiceException.class)
                .hasMessageContaining("누적 수집 수와 전체 상품 수가 다릅니다");
        InOrder order = inOrder(client);
        order.verify(client).fetch(FIRST_CATEGORY, 1);
        order.verify(client).fetch(FIRST_CATEGORY, 2);
        order.verify(client).fetch(FIRST_CATEGORY, 3);
        order.verifyNoMoreInteractions();
    }

    @Test
    @DisplayName("같은 이름과 모든 필드가 같은 상품도 원본 그대로 유지한다")
    void preservesDuplicates() {
        for (Emart24ProductCategory category : Emart24ProductCategory.values()) {
            when(client.fetch(category, 1)).thenReturn(page(category, 1, 2, false,
                    product("동일 상품"), product("동일 상품")));
        }

        List<PromotionProduct> result = fetcher.fetch();

        assertThat(result).hasSize(8);
        assertThat(result.get(0)).isEqualTo(result.get(1));
        verifyOnlyFirstPages();
    }

    private void assertResponseFailure(final Emart24PromotionFetcher fetcher) {
        assertThatThrownBy(fetcher::fetch).isInstanceOfSatisfying(UpstreamServiceException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PROMOTION_RESPONSE_INVALID));
    }

    private void verifyOnlyFirstPages() {
        InOrder order = inOrder(client);
        for (Emart24ProductCategory category : Emart24ProductCategory.values()) {
            order.verify(client).fetch(category, 1);
        }
        verifyNoMoreInteractions(client);
    }

    private void verifyOnlyFirstCategoryTwoPages() {
        InOrder order = inOrder(client);
        order.verify(client).fetch(FIRST_CATEGORY, 1);
        order.verify(client).fetch(FIRST_CATEGORY, 2);
        order.verifyNoMoreInteractions();
    }
}
