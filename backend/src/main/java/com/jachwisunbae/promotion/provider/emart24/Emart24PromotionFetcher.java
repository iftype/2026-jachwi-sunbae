package com.jachwisunbae.promotion.provider.emart24;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.provider.PromotionFetcher;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

// 이마트24의 모든 카테고리와 페이지를 끝까지 수집해야만 결과를 반환한다.
@Component
public class Emart24PromotionFetcher implements PromotionFetcher {

    private static final int MAX_PAGE_COUNT = 100;

    private final Emart24PromotionClient client;
    private final Emart24PromotionParser parser = new Emart24PromotionParser();
    private final int maxPageCount;

    @Autowired
    public Emart24PromotionFetcher(final Emart24PromotionClient client) {
        this(client, MAX_PAGE_COUNT);
    }

    Emart24PromotionFetcher(final Emart24PromotionClient client, final int maxPageCount) {
        if (maxPageCount < 1) {
            throw new IllegalArgumentException("최대 수집 페이지는 1 이상이어야 합니다.");
        }
        this.client = client;
        this.maxPageCount = maxPageCount;
    }

    @Override
    public List<PromotionProduct> fetch() {
        List<PromotionProduct> products = new ArrayList<>();
        for (Emart24ProductCategory category : Emart24ProductCategory.values()) {
            products.addAll(fetchCategory(category));
        }
        // 이름만으로 동일 상품을 판단할 수 없으므로 원본 분류와 중복을 보존한다.
        return List.copyOf(products);
    }

    private List<PromotionProduct> fetchCategory(final Emart24ProductCategory category) {
        List<PromotionProduct> products = new ArrayList<>();
        Integer totalCount = null;
        for (int page = 1; page <= maxPageCount; page++) {
            Emart24PromotionParser.Page result = parser.parse(client.fetch(category, page), category, page);
            if (totalCount != null && totalCount != result.totalCount()) {
                throw new UpstreamServiceException(ErrorCode.PROMOTION_RESPONSE_INVALID,
                        "수집 중 이마트24 전체 상품 수가 달라졌습니다. category=" + category + ", page=" + page);
            }
            totalCount = result.totalCount();
            products.addAll(result.products());
            if (result.last()) {
                if (products.size() != totalCount) {
                    throw new UpstreamServiceException(ErrorCode.PROMOTION_RESPONSE_INVALID,
                            "이마트24 누적 수집 수와 전체 상품 수가 다릅니다. category=" + category
                                    + ", expected=" + totalCount + ", actual=" + products.size());
                }
                return products;
            }
        }
        throw new UpstreamServiceException(ErrorCode.PROMOTION_RESPONSE_INVALID,
                "이마트24 최대 수집 페이지를 초과했습니다. category=" + category + ", limit=" + maxPageCount);
    }
}
