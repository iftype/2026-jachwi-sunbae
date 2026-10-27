package com.jachwisunbae.promotion.provider.emart24;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.stream.IntStream;
import org.springframework.core.io.ClassPathResource;

final class Emart24PromotionFixtures {

    private static final String PAGE = read("page.html");
    private static final String PRODUCT = read("product.html");

    private Emart24PromotionFixtures() {
    }

    static String product(final String name) {
        return PRODUCT.replace("{{NAME}}", name);
    }

    static String[] products(final int count, final String prefix) {
        return IntStream.range(0, count).mapToObj(index -> product(prefix + index)).toArray(String[]::new);
    }

    static String page(final Emart24ProductCategory category, final int page, final int total,
                       final boolean hasNext, final String... products) {
        return PAGE.replace("{{PAGE}}", String.valueOf(page))
                .replace("{{CATEGORY}}", String.valueOf(category.code()))
                .replace("{{TOTAL}}", String.valueOf(total))
                .replace("{{NEXT}}", hasNext ? "<a href='/goods/event?page=" + (page + 1) + "'>다음</a>" : "")
                .replace("{{PRODUCTS}}", String.join("\n", products));
    }

    static String emptyPage(final Emart24ProductCategory category) {
        return page(category, 1, 0, false)
                .replace("const pageLength = \"20\";", "const pageLength = null;")
                .replace("const totalCount = \"0\";", "const totalCount = null;");
    }

    private static String read(final String name) {
        try {
            return new ClassPathResource("promotion/emart24/" + name).getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
