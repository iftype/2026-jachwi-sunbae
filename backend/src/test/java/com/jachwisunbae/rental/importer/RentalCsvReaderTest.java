package com.jachwisunbae.rental.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.rental.domain.AreaBasis;
import com.jachwisunbae.rental.domain.ContractType;
import com.jachwisunbae.rental.domain.HousingType;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class RentalCsvReaderTest {
    private static final String HEADER = "legal_dong,housing_type,deposit_10k_krw,monthly_rent_10k_krw,area_m2,"
        + "area_basis,contract_date,contract_type,building_name,floor,contract_period,source_file,source_row_number\n";
    private static final LegalDongCatalog CATALOG = new LegalDongCatalog(Map.of("서울특별시 관악구 신림동", "1162010200"));

    @TempDir
    Path directory;

    @Test
    void readsBomQuotedFieldsAndConvertsTenThousandWonToWon() throws Exception {
        Path path = write("\uFEFF", csvRecord("20", 1));

        var result = new RentalCsvReader().read(path, CATALOG);

        assertThat(result.transactions()).hasSize(1);
        var transaction = result.transactions().getFirst();
        assertThat(transaction.legalDong().code()).isEqualTo("1162010200");
        assertThat(transaction.price().depositAmountKrw()).isEqualTo(5000000);
        assertThat(transaction.price().monthlyRentAmountKrw()).isEqualTo(450000);
        assertThat(transaction.buildingName()).isEqualTo("신림,빌라");
        assertThat(transaction.area().areaBasis()).isEqualTo(AreaBasis.EXCLUSIVE);
    }

    @Test
    void rejectsMissingRequiredHeaders() throws Exception {
        Path path = directory.resolve("transactions.csv");
        Files.writeString(path, HEADER.replace("housing_type", "unsupported_header") + csvRecord("20", 1),
            StandardCharsets.UTF_8);

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("정제 거래 CSV의 필수 헤더가 누락됐습니다.");
    }

    @Test
    void rejectsInconsistentColumnCount() throws Exception {
        Path path = write("", csvRecord("20", 1).stripTrailing() + ",extra\n");

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("CSV 열 수가 일치하지 않습니다: 1");
    }

    @Test
    void rejectsHeaderOnlyCsv() throws Exception {
        Path path = write("", "");

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("거래 CSV가 비어 있습니다.");
    }

    @Test
    void preservesIdenticalContractsWithDifferentSourceRows() throws Exception {
        Path path = write("", csvRecord("20", 1) + csvRecord("20", 2));

        var result = new RentalCsvReader().read(path, CATALOG);

        assertThat(result.transactions()).hasSize(2);
    }

    @ParameterizedTest
    @CsvSource({"신규,NEW", "갱신,RENEWAL", "-,UNKNOWN", "'',UNKNOWN"})
    void convertsSourceContractTypeToEnum(final String sourceType, final ContractType expected) throws Exception {
        Path path = write("", csvRecord("20", 1).replace(",신규,", "," + sourceType + ","));

        var result = new RentalCsvReader().read(path, CATALOG);

        assertThat(result.transactions().getFirst().contractType()).isEqualTo(expected);
    }

    @Test
    void rejectsUnrecognizedContractTypeInsteadOfTreatingItAsUnknown() throws Exception {
        Path path = write("", csvRecord("20", 1).replace(",신규,", ",미지원,"));

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("CSV 거래 값이 올바르지 않습니다: 행 1")
            .hasRootCauseMessage("알 수 없는 계약 구분입니다.");
    }

    @ParameterizedTest
    @CsvSource({"연립다세대,exclusive,ROWHOUSE,EXCLUSIVE", "단독다가구,contract,DETACHED,CONTRACT",
        "오피스텔,exclusive,OFFICETEL,EXCLUSIVE"})
    void convertsSourceHousingTypeAndAreaBasisToStandaloneEnums(
        final String sourceHousingType, final String sourceAreaBasis,
        final HousingType expectedHousingType, final AreaBasis expectedAreaBasis
    ) throws Exception {
        Path path = write("", csvRecord("20", 1)
            .replace("연립다세대", sourceHousingType).replace("exclusive", sourceAreaBasis));

        var transaction = new RentalCsvReader().read(path, CATALOG).transactions().getFirst();

        assertThat(transaction.housingType()).isEqualTo(expectedHousingType);
        assertThat(transaction.area().areaBasis()).isEqualTo(expectedAreaBasis);
    }

    @Test
    void rejectsUnrecognizedHousingType() throws Exception {
        Path path = write("", csvRecord("20", 1).replace("연립다세대", "아파트"));

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasRootCauseMessage("알 수 없는 주택 유형입니다.");
    }

    @Test
    void rejectsUnrecognizedAreaBasis() throws Exception {
        Path path = write("", csvRecord("20", 1).replace("exclusive", "미지원"));

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasRootCauseMessage("알 수 없는 면적 기준입니다.");
    }

    @Test
    void preservesSameRowNumberFromDifferentSourceFiles() throws Exception {
        Path path = write("", csvRecord("20", 1) + csvRecord("20", 1).replace("raw/source.csv", "raw/other.csv"));

        var result = new RentalCsvReader().read(path, CATALOG);

        assertThat(result.transactions()).hasSize(2);
    }

    @Test
    void rejectsRepeatedSourceIdentity() throws Exception {
        Path path = write("", csvRecord("20", 1) + csvRecord("20", 1));

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("중복");
    }

    @Test
    void rejectsRepeatedSourceIdentityBeforeSkippingUnmatchedNames() throws Exception {
        String unmatchedRecord = csvRecord("20", 1).replace("서울특별시 관악구 신림동", "경기도 관악구 신림동");
        Path path = write("", unmatchedRecord + unmatchedRecord);

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("원본 행 식별자가 중복됐습니다");
    }

    @Test
    void reportsUnmatchedNamesInsteadOfGuessingFromDongName() throws Exception {
        Path path = write("", csvRecord("20", 1).replace("서울특별시 관악구 신림동", "경기도 관악구 신림동"));

        var result = new RentalCsvReader().read(path, CATALOG);

        assertThat(result.transactions()).isEmpty();
        assertThat(result.unmatched()).containsEntry("경기도 관악구 신림동", 1);
        assertThat(result.totalRows()).isOne();
    }

    @ParameterizedTest
    @ValueSource(strings = {"16.5290", "33.0578"})
    void includesAreasWithinExactFiveToTenPyeongBoundaries(final String area) throws Exception {
        Path path = write("", csvRecord(area, 1));

        var result = new RentalCsvReader().read(path, CATALOG);

        assertThat(result.transactions()).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"16.5289", "33.0579"})
    void rejectsAreasOutsideExactFiveToTenPyeongBoundaries(final String area) throws Exception {
        Path path = write("", csvRecord(area, 1));

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasRootCauseMessage("면적은 5~10평 범위여야 합니다.");
    }

    @ParameterizedTest
    @CsvSource({"단독다가구,exclusive", "연립다세대,contract", "오피스텔,contract"})
    void rejectsHousingTypeAndAreaBasisMismatch(final String housingType, final String areaBasis) throws Exception {
        Path path = write("", csvRecord("20", 1).replace("연립다세대", housingType).replace("exclusive", areaBasis));

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasRootCauseMessage("주택 유형과 면적 기준이 일치하지 않습니다.");
    }

    @ParameterizedTest
    @CsvSource({"-1,45", "500,0", "500,-1"})
    void rejectsInvalidRentAmounts(final String deposit, final String monthlyRent) throws Exception {
        Path path = write("", csvRecord("20", 1).replace(",500,45,", "," + deposit + "," + monthlyRent + ","));

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasRootCauseMessage("보증금은 0원 이상, 월세는 0원보다 커야 합니다.");
    }

    @Test
    void rejectsAreaPrecisionLossInsteadOfRounding() throws Exception {
        Path path = write("", csvRecord("20.00001", 1));

        assertThatThrownBy(() -> new RentalCsvReader().read(path, CATALOG))
            .isInstanceOf(IllegalArgumentException.class).hasRootCauseInstanceOf(ArithmeticException.class);
    }

    private Path write(final String prefix, final String csvRecords) throws Exception {
        Path path = directory.resolve("transactions.csv");
        Files.writeString(path, prefix + HEADER + csvRecords, StandardCharsets.UTF_8);
        return path;
    }

    private String csvRecord(final String area, final int number) {
        return "서울특별시 관악구 신림동,연립다세대,500,45," + area
            + ",exclusive,2026-10-08,신규,\"신림,빌라\",-1,202610~202810,raw/source.csv," + number + "\n";
    }
}
