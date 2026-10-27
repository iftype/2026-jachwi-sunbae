package com.jachwisunbae.promotion.provider.emart24;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.domain.PromotionType;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

// 이마트24 행사상품 페이지 HTML을 검증하고 공통 행사상품 모델로 변환한다.
class Emart24PromotionParser {

    Page parse(final String html, final Emart24ProductCategory category, final int requestedPage) {
        if (html == null || html.isBlank()) {
            throw invalidResponse("HTML 응답이 비어 있습니다.");
        }
        Document document = Jsoup.parse(html, Emart24PromotionClient.BASE_URL + "/goods/event");
        Element list = requireElement(document, "section.itemList");
        Element next = requireElement(document, ".pageNationWrap .next");
        String metadata = document.select("script:not([src])").stream()
                .map(Element::data).reduce("", (left, right) -> left + "\n" + right);
        Integer page = readNumber(metadata, "page");
        Integer categoryCode = readNumber(metadata, "baseCategorySeq");
        Integer promotionCode = readNumber(metadata, "categorySeq");
        if (!Integer.valueOf(requestedPage).equals(page)
                || !Integer.valueOf(category.code()).equals(categoryCode) || promotionCode != null) {
            throw invalidResponse("요청한 페이지·카테고리·전체 혜택과 응답이 다릅니다. page=" + requestedPage);
        }

        Integer pageSize = readNumber(metadata, "pageLength");
        Integer totalCount = readNumber(metadata, "totalCount");
        Elements cards = list.select("div.itemWrap");
        boolean hasNext = !next.select("a[href]").isEmpty();
        // 실제 빈 카테고리 응답은 목록·페이저를 유지하고 두 메타데이터를 null로 표시한다.
        if (totalCount == null && pageSize == null && cards.isEmpty() && requestedPage == 1 && !hasNext) {
            return new Page(List.of(), 0, true);
        }
        if (totalCount == null || pageSize == null || pageSize <= 0 || totalCount < 0) {
            throw invalidResponse("페이지 크기 또는 전체 상품 수가 올바르지 않습니다.");
        }
        long offset = (long) (requestedPage - 1) * pageSize;
        int expectedCount = (int) Math.min(pageSize, Math.max(0, totalCount - offset));
        boolean last = offset + pageSize >= totalCount;
        if (cards.size() != expectedCount || (expectedCount == 0 && requestedPage != 1) || hasNext == last) {
            throw invalidResponse("상품 카드 수 또는 마지막 페이지 표시가 맞지 않습니다. page=" + requestedPage
                    + ", expected=" + expectedCount + ", actual=" + cards.size());
        }
        List<PromotionProduct> products = cards.stream().map(card -> parseProduct(card, category)).toList();
        return new Page(products, totalCount, last);
    }

    private PromotionProduct parseProduct(final Element card, final Emart24ProductCategory category) {
        String name = requireElement(card, ".itemtitle p a").text().replaceAll("(?U)\\s+", " ").strip();
        String priceText = requireElement(card, ".itemTxtWrap .price").text().strip();
        if (!priceText.matches("(?:0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)\\s*원")) {
            throw invalidResponse("판매가격 형식이 올바르지 않습니다. price=" + priceText);
        }
        int price;
        try {
            price = Integer.parseInt(priceText.replaceAll("[,\\s원]", ""));
        } catch (NumberFormatException exception) {
            throw new UpstreamServiceException(ErrorCode.PROMOTION_RESPONSE_INVALID,
                    "이마트24 판매가격이 정수 범위를 벗어났습니다.", exception);
        }
        Element image = requireElement(card, ".itemSpImg img");
        // 빈 src는 absUrl이 페이지 주소로 바꾸므로 먼저 거부한다.
        if (image.attr("src").isBlank()) {
            throw invalidResponse("이미지 src가 비어 있습니다.");
        }
        String imageUrl = image.absUrl("src");
        String badge = requireElement(card, ".itemTit .floatR").text().replaceAll("(?U)\\s+", "");
        PromotionType promotionType = switch (badge) {
            case "1+1" -> PromotionType.ONE_PLUS_ONE;
            case "2+1" -> PromotionType.TWO_PLUS_ONE;
            case "3+1" -> PromotionType.THREE_PLUS_ONE;
            case "세일" -> PromotionType.SALE;
            case "골라담기" -> PromotionType.PICK_AND_MIX;
            default -> throw invalidResponse("확인되지 않은 행사 유형입니다. badge=" + badge);
        };
        // 빈 상품명과 절대 HTTP가 아닌 이미지 주소는 도메인 검증에서 거부한다.
        try {
            return new PromotionProduct(ConvenienceBrand.EMART24, name, price, imageUrl, category.category(),
                    promotionType);
        } catch (IllegalArgumentException exception) {
            throw new UpstreamServiceException(ErrorCode.PROMOTION_RESPONSE_INVALID,
                    "이마트24 상품 정보가 올바르지 않습니다. name=" + name + ", image=" + imageUrl, exception);
        }
    }

    private Element requireElement(final Element root, final String selector) {
        Elements elements = root.select(selector);
        if (elements.size() != 1) {
            throw invalidResponse("필수 HTML 요소를 하나로 찾지 못했습니다. selector=" + selector);
        }
        return elements.first();
    }

    private Integer readNumber(final String metadata, final String name) {
        Pattern pattern = Pattern.compile("(?m)^\\s*const\\s+" + name + "\\s*=\\s*(null|\"[0-9]+\")\\s*;");
        Matcher matcher = pattern.matcher(metadata);
        if (!matcher.find()) {
            throw invalidResponse("페이지 메타데이터를 찾지 못했습니다. field=" + name);
        }
        String value = matcher.group(1);
        if (matcher.find()) {
            throw invalidResponse("페이지 메타데이터가 중복됩니다. field=" + name);
        }
        if ("null".equals(value)) {
            return null;
        }
        try {
            return Integer.valueOf(value.substring(1, value.length() - 1));
        } catch (NumberFormatException exception) {
            throw new UpstreamServiceException(ErrorCode.PROMOTION_RESPONSE_INVALID,
                    "이마트24 페이지 메타데이터가 정수 범위를 벗어났습니다. field=" + name, exception);
        }
    }

    private UpstreamServiceException invalidResponse(final String message) {
        return new UpstreamServiceException(ErrorCode.PROMOTION_RESPONSE_INVALID, "이마트24 " + message);
    }

    record Page(List<PromotionProduct> products, int totalCount, boolean last) {
        Page {
            products = List.copyOf(products);
        }
    }
}
