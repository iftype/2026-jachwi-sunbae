package com.jachwisunbae.promotion.provider.emart24;

import static com.jachwisunbae.promotion.provider.emart24.Emart24PromotionFixtures.emptyPage;
import static com.jachwisunbae.promotion.provider.emart24.Emart24PromotionFixtures.page;
import static com.jachwisunbae.promotion.provider.emart24.Emart24PromotionFixtures.product;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.ProductCategory;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.domain.PromotionType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class Emart24PromotionParserTest {

    private static final Emart24ProductCategory CATEGORY = Emart24ProductCategory.MEAL;
    private static final String IMAGE = "https://msave.emart24.co.kr/cmsbo/upload/nHq/plu_image/500x500/014113950015.JPG";

    private final Emart24PromotionParser parser = new Emart24PromotionParser();

    @Test
    @DisplayName("상품명 공백을 정리하고 정상가 대신 판매가격과 이미지·분류·혜택을 추출한다")
    void parsesSaleProduct() {
        String card = product("  선명)원더풀피스타치오가염150g\n &nbsp; 행사  ");

        Emart24PromotionParser.Page result = parser.parse(page(CATEGORY, 1, 1, false, card), CATEGORY, 1);

        assertThat(result.products()).containsExactly(new PromotionProduct(ConvenienceBrand.EMART24,
                "선명)원더풀피스타치오가염150g 행사", 7980, IMAGE, ProductCategory.MEAL, PromotionType.SALE));
        assertThat(result.totalCount()).isEqualTo(1);
        assertThat(result.last()).isTrue();
    }

    @Test
    @DisplayName("정상가 위치가 판매가격 뒤로 옮겨져도 price 클래스로 판매가격을 선택한다")
    void selectsSalePriceRegardlessOfOrder() {
        String card = product("행사상품").replace("<a href=\"#none\" class=\"priceOff\">9,980 원</a>", "")
                .replace("7,980 원</a>", "7,980 원</a><a class='priceOff'>9,980 원</a>");

        assertThat(parser.parse(page(CATEGORY, 1, 1, false, card), CATEGORY, 1).products().getFirst().price())
                .isEqualTo(7980);
    }

    @ParameterizedTest
    @CsvSource({"1 + 1, ONE_PLUS_ONE", "2 + 1, TWO_PLUS_ONE", "3 + 1, THREE_PLUS_ONE",
            "세일, SALE", "골라담기, PICK_AND_MIX"})
    @DisplayName("공식 상품 카드에 표시된 다섯 가지 행사 유형을 구분한다")
    void mapsPromotionType(final String badge, final PromotionType expected) {
        String card = product("행사상품").replace("세일", badge)
                .replace("<a href=\"#none\" class=\"priceOff\">9,980 원</a>", "");

        assertThat(parser.parse(page(CATEGORY, 1, 1, false, card), CATEGORY, 1).products().getFirst().promotionType())
                .isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"MEAL, 1, MEAL", "SNACK, 2, SNACK", "BEVERAGE, 5, BEVERAGE",
            "HOUSEHOLD_GOODS, 3, HOUSEHOLD_GOODS"})
    @DisplayName("외부 카테고리 코드를 제공자 내부에서 공통 상품 분류로 변환한다")
    void mapsProductCategory(final Emart24ProductCategory category, final int code, final ProductCategory expected) {
        assertThat(category.code()).isEqualTo(code);
        PromotionProduct result = parser.parse(page(category, 1, 1, false, product("상품")), category, 1)
                .products().getFirst();
        assertThat(result.category()).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"/images/product.jpg, https://emart24.co.kr/images/product.jpg",
            "//msave.emart24.co.kr/product.jpg, https://msave.emart24.co.kr/product.jpg",
            "product.jpg, https://emart24.co.kr/goods/product.jpg"})
    @DisplayName("src의 상대 경로와 프로토콜 생략 경로를 절대 이미지 URL로 바꾼다")
    void resolvesImageUrl(final String src, final String expected) {
        String card = product("상품").replace(IMAGE, src);

        assertThat(parser.parse(page(CATEGORY, 1, 1, false, card), CATEGORY, 1).products().getFirst().imageUrl())
                .isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"itemtitle", "price", "itemSpImg", "floatR"})
    @DisplayName("필수 요소가 없으면 상품을 건너뛰지 않고 응답 오류로 중단한다")
    void rejectsMissingRequiredElement(final String className) {
        String card = product("상품").replace("class=\"" + className + "\"", "class=\"changed\"")
                .replace("sale floatR", className.equals("floatR") ? "sale changed" : "sale floatR");
        assertInvalid(page(CATEGORY, 1, 1, false, card));
    }

    @ParameterizedTest
    @ValueSource(strings = {"가격문의", "12,34 원", "-100 원", "1.5 원", "2147483648 원", "원", "7,980 달러"})
    @DisplayName("숫자를 임의로 골라내지 않고 잘못된 가격 형식과 정수 범위 초과를 거부한다")
    void rejectsInvalidPrice(final String price) {
        assertInvalid(page(CATEGORY, 1, 1, false, product("상품").replace("7,980 원", price)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"4+1", "할인예정", ""})
    @DisplayName("알 수 없거나 비어 있는 혜택은 추측하지 않는다")
    void rejectsUnknownPromotion(final String badge) {
        assertInvalid(page(CATEGORY, 1, 1, false, product("상품").replace("세일", badge)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "javascript:alert(1)", "data:image/png;base64,test", "https://[invalid"})
    @DisplayName("공개 HTTP 이미지 주소가 아니면 파싱에 실패한다")
    void rejectsInvalidImageUrl(final String src) {
        assertInvalid(page(CATEGORY, 1, 1, false, product("상품").replace(IMAGE, src)));
    }

    @Test
    @DisplayName("빈 상품명을 거부한다")
    void rejectsBlankName() {
        assertInvalid(page(CATEGORY, 1, 1, false, product(" &nbsp; ")));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "<html>점검 중</html>"})
    @DisplayName("빈 본문과 구조가 다른 HTTP 200 응답을 빈 상품 목록으로 처리하지 않는다")
    void rejectsChangedStructure(final String html) {
        assertInvalid(html);
    }

    @Test
    @DisplayName("상품 수는 양수인데 카드를 찾지 못하면 구조 변경으로 판단한다")
    void rejectsMissingCards() {
        assertInvalid(page(CATEGORY, 1, 1, false));
    }

    @Test
    @DisplayName("실제 빈 카테고리의 null 메타데이터와 정상 목록·페이저를 확인한다")
    void acceptsExplicitEmptyCategory() {
        Emart24PromotionParser.Page result = parser.parse(emptyPage(CATEGORY), CATEGORY, 1);

        assertThat(result.products()).isEmpty();
        assertThat(result.totalCount()).isZero();
        assertThat(result.last()).isTrue();
        assertInvalid(emptyPage(CATEGORY).replace("itemList", "changed"));
        assertInvalid(emptyPage(CATEGORY).replace("const totalCount = null;", ""));
    }

    @ParameterizedTest
    @CsvSource({"page, 2", "baseCategorySeq, 2", "categorySeq, 1", "pageLength, 0", "totalCount, 2"})
    @DisplayName("요청과 다른 페이지·분류·혜택 및 카드 수와 맞지 않는 메타데이터를 거부한다")
    void rejectsInconsistentMetadata(final String field, final String value) {
        String html = page(CATEGORY, 1, 1, false, product("상품"))
                .replaceAll("const " + field + " = (null|\"[0-9]+\");", "const " + field + " = \"" + value + "\";");
        assertInvalid(html);
    }

    @Test
    @DisplayName("메타데이터 누락·중복과 마지막 페이지 표시 불일치를 거부한다")
    void rejectsMissingOrAmbiguousMetadataAndPager() {
        String html = page(CATEGORY, 1, 1, false, product("상품"));
        assertInvalid(html.replace("const pageLength = \"20\";", ""));
        assertInvalid(html.replace("const totalCount = \"1\";", "const totalCount = \"1\";\nconst totalCount = \"1\";"));
        assertInvalid(html.replace("class=\"next\"", "class=\"changed\""));
        assertInvalid(page(CATEGORY, 1, 1, true, product("상품")));
    }

    @Test
    @DisplayName("마지막 중간 페이지의 빈 결과를 정상 종료로 처리하지 않는다")
    void rejectsEmptyLaterPage() {
        assertThatThrownBy(() -> parser.parse(page(CATEGORY, 2, 20, false), CATEGORY, 2))
                .isInstanceOf(UpstreamServiceException.class);
    }

    private void assertInvalid(final String html) {
        assertThatThrownBy(() -> parser.parse(html, CATEGORY, 1))
                .isInstanceOfSatisfying(UpstreamServiceException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PROMOTION_RESPONSE_INVALID));
    }
}
