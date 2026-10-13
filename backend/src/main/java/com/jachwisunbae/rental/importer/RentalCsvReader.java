package com.jachwisunbae.rental.importer;

import com.jachwisunbae.rental.domain.AreaBasis;
import com.jachwisunbae.rental.domain.ContractType;
import com.jachwisunbae.rental.domain.HousingType;
import com.jachwisunbae.rental.domain.LegalDong;
import com.jachwisunbae.rental.domain.RentalArea;
import com.jachwisunbae.rental.domain.RentalPrice;
import com.jachwisunbae.rental.domain.RentalSource;
import com.jachwisunbae.rental.domain.RentalTransaction;
import java.io.IOException;
import java.io.PushbackReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.csv.DuplicateHeaderMode;

// 정제 CSV를 검증하고 거래 변환과 법정동 매핑을 수행한다.
public class RentalCsvReader {
    private static final Set<String> REQUIRED = Set.of(
        "legal_dong", "housing_type", "deposit_10k_krw", "monthly_rent_10k_krw", "area_m2",
        "area_basis", "contract_date", "contract_type", "building_name", "floor",
        "contract_period", "source_file", "source_row_number"
    );

    public Result read(final Path path, final LegalDongCatalog catalog) throws IOException {
        CSVFormat format = CSVFormat.RFC4180.builder().setHeader().setSkipHeaderRecord(true)
            .setDuplicateHeaderMode(DuplicateHeaderMode.DISALLOW).get();
        try (PushbackReader reader = new PushbackReader(Files.newBufferedReader(path, StandardCharsets.UTF_8))) {
            skipBom(reader);
            try (CSVParser parser = format.parse(reader)) {
                validateHeaders(parser);
                return readRecords(parser, catalog);
            }
        }
    }

    private void skipBom(final PushbackReader reader) throws IOException {
        int first = reader.read();
        if (first != -1 && first != '\uFEFF') {
            reader.unread(first);
        }
    }

    private void validateHeaders(final CSVParser parser) {
        if (!parser.getHeaderMap().keySet().containsAll(REQUIRED)) {
            throw new IllegalArgumentException("정제 거래 CSV의 필수 헤더가 누락됐습니다.");
        }
    }

    private Result readRecords(final CSVParser parser, final LegalDongCatalog catalog) {
        List<RentalTransaction> transactions = new ArrayList<>();
        Map<String, Integer> unmatched = new TreeMap<>();
        Set<SourceRow> identities = new HashSet<>();
        int totalRows = 0;
        for (CSVRecord csvRecord : parser) {
            totalRows++;
            validateColumnCount(csvRecord);
            String legalDongName = LegalDongCatalog.normalizeName(csvRecord.get("legal_dong"));
            validateUniqueSourceRow(csvRecord, identities);
            String legalDongCode = catalog.findCode(legalDongName).orElse(null);
            if (legalDongCode == null) {
                unmatched.merge(legalDongName, 1, Integer::sum);
                continue;
            }
            transactions.add(parse(csvRecord, legalDongCode, legalDongName));
        }
        validateNotEmpty(totalRows);
        return new Result(transactions, unmatched, totalRows);
    }

    private void validateColumnCount(final CSVRecord csvRecord) {
        if (!csvRecord.isConsistent()) {
            throw new IllegalArgumentException("CSV 열 수가 일치하지 않습니다: " + csvRecord.getRecordNumber());
        }
    }

    private void validateUniqueSourceRow(final CSVRecord csvRecord, final Set<SourceRow> identities) {
        SourceRow identity = new SourceRow(csvRecord.get("source_file"), Long.parseLong(csvRecord.get("source_row_number")));
        if (!identities.add(identity)) {
            throw new IllegalArgumentException("원본 행 식별자가 중복됐습니다: " + identity);
        }
    }

    private void validateNotEmpty(final int totalRows) {
        if (totalRows == 0) {
            throw new IllegalArgumentException("거래 CSV가 비어 있습니다.");
        }
    }

    private RentalTransaction parse(
        final CSVRecord csvRecord, final String legalDongCode, final String legalDongName
    ) {
        try {
            return createTransaction(csvRecord, legalDongCode, legalDongName);
        } catch (IllegalArgumentException | ArithmeticException exception) {
            throw new IllegalArgumentException("CSV 거래 값이 올바르지 않습니다: 행 "
                + csvRecord.getRecordNumber(), exception);
        }
    }

    private RentalTransaction createTransaction(
        final CSVRecord csvRecord, final String legalDongCode, final String legalDongName
    ) {
        HousingType housingType = HousingType.fromSourceValue(csvRecord.get("housing_type"));
        AreaBasis areaBasis = AreaBasis.fromSourceValue(csvRecord.get("area_basis"));
        ContractType contractType = ContractType.fromSourceValue(csvRecord.get("contract_type"));
        return new RentalTransaction(new LegalDong(legalDongCode, legalDongName), housingType,
            new RentalPrice(
                new BigDecimal(csvRecord.get("deposit_10k_krw")).multiply(BigDecimal.valueOf(10000)).longValueExact(),
                new BigDecimal(csvRecord.get("monthly_rent_10k_krw")).multiply(BigDecimal.valueOf(10000)).longValueExact()),
            new RentalArea(new BigDecimal(csvRecord.get("area_m2")), areaBasis),
            LocalDate.parse(csvRecord.get("contract_date")),
            contractType, csvRecord.get("building_name"), csvRecord.get("floor"), csvRecord.get("contract_period"),
            new RentalSource(csvRecord.get("source_file"), Long.parseLong(csvRecord.get("source_row_number"))));
    }

    // 원본 파일과 행 번호로 중복 거래를 식별한다.
    private record SourceRow(String sourceFile, long sourceRowNumber) {
    }

    // 변환한 거래, 미매핑 법정동 집계와 전체 입력 건수를 전달한다.
    public record Result(List<RentalTransaction> transactions, Map<String, Integer> unmatched, int totalRows) {
        public Result {
            transactions = List.copyOf(transactions);
            unmatched = Map.copyOf(unmatched);
        }
    }
}
