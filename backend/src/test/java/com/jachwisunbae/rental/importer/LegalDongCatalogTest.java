package com.jachwisunbae.rental.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LegalDongCatalogTest {
    @TempDir
    Path directory;

    @Test
    void mapsFullNamesAndIgnoresAbolishedCodes() throws Exception {
        Path path = write("""
            1162010100\t서울특별시 관악구 봉천동\t존재
            1162010200\t서울특별시 관악구 신림동\t존재
            1199910200\t서울특별시 관악구 신림동\t폐지
            4127310100\t경기도 안산시 단원구 신림동\t존재
            """);

        LegalDongCatalog catalog = LegalDongCatalog.load(path);

        assertThat(catalog.findCode("서울특별시  관악구 신림동 ")).contains("1162010200");
        assertThat(catalog.findCode("경기도 안산시 단원구 신림동")).contains("4127310100");
        assertThat(catalog.findCode("신림동")).isEmpty();
    }

    @Test
    void rejectsAmbiguousActiveCodes() throws Exception {
        Path path = write("""
            1162010200\t서울특별시 관악구 신림동\t존재
            1199910200\t서울특별시 관악구 신림동\t존재
            """);

        assertThatThrownBy(() -> LegalDongCatalog.load(path))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("여러 개");
    }

    @Test
    void readsOfficialZipWithMs949EntryNameAndContents() throws Exception {
        Path path = directory.resolve("codes.zip");
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(path), Charset.forName("MS949"))) {
            zip.putNextEntry(new ZipEntry("법정동코드 전체자료.txt"));
            zip.write(("법정동코드\t법정동명\t폐지여부\n"
                + "1162010200\t서울특별시 관악구 신림동\t존재\n").getBytes(Charset.forName("MS949")));
            zip.closeEntry();
        }

        LegalDongCatalog catalog = LegalDongCatalog.load(path);

        assertThat(catalog.findCode("서울특별시 관악구 신림동")).contains("1162010200");
    }

    private Path write(final String csvRecords) throws Exception {
        Path path = directory.resolve("codes.txt");
        Files.writeString(path, "법정동코드\t법정동명\t폐지여부\n" + csvRecords, Charset.forName("MS949"));
        return path;
    }
}
