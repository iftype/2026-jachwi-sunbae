package com.jachwisunbae.rental.importer;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipInputStream;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.csv.DuplicateHeaderMode;

public record LegalDongCatalog(Map<String, String> codesByName) {
    public LegalDongCatalog {
        codesByName = Map.copyOf(codesByName);
    }

    public static LegalDongCatalog load(final Path path) throws IOException {
        try (InputStream input = Files.newInputStream(path)) {
            if (path.getFileName().toString().endsWith(".zip")) {
                try (ZipInputStream zip = new ZipInputStream(input, Charset.forName("MS949"))) {
                    if (zip.getNextEntry() == null) {
                        throw new IllegalArgumentException("법정동 코드 ZIP이 비어 있습니다.");
                    }
                    return read(new InputStreamReader(zip, Charset.forName("MS949")));
                }
            }
            return read(new InputStreamReader(input, Charset.forName("MS949")));
        }
    }

    private static LegalDongCatalog read(final Reader reader) throws IOException {
        Map<String, String> codes = new HashMap<>();
        CSVFormat format = CSVFormat.TDF.builder().setHeader().setSkipHeaderRecord(true)
            .setDuplicateHeaderMode(DuplicateHeaderMode.DISALLOW).get();
        try (CSVParser parser = format.parse(reader)) {
            if (!parser.getHeaderMap().keySet().containsAll(
                java.util.Set.of("법정동코드", "법정동명", "폐지여부"))) {
                throw new IllegalArgumentException("공식 법정동 코드 파일의 헤더가 필요합니다.");
            }
            for (CSVRecord csvRecord : parser) {
                if (!csvRecord.isConsistent() || !java.util.Set.of("존재", "폐지").contains(csvRecord.get("폐지여부"))) {
                    throw new IllegalArgumentException("법정동 코드 파일의 행이 올바르지 않습니다.");
                }
                if (!csvRecord.get("폐지여부").equals("존재")) {
                    continue;
                }
                String legalDongName = normalizeName(csvRecord.get("법정동명"));
                String legalDongCode = csvRecord.get("법정동코드").strip();
                if (!legalDongCode.matches("[0-9]{10}") || legalDongName.isBlank()) {
                    throw new IllegalArgumentException("공식 법정동 코드 값이 올바르지 않습니다.");
                }
                String previous = codes.putIfAbsent(legalDongName, legalDongCode);
                if (previous != null && !previous.equals(legalDongCode)) {
                    throw new IllegalArgumentException("현재 법정동 이름에 코드가 여러 개 있습니다: " + legalDongName);
                }
            }
        }
        if (codes.isEmpty()) {
            throw new IllegalArgumentException("현재 법정동 코드가 없습니다.");
        }
        return new LegalDongCatalog(codes);
    }

    public Optional<String> findCode(final String fullName) {
        return Optional.ofNullable(codesByName.get(normalizeName(fullName)));
    }

    public static String normalizeName(final String fullName) {
        return fullName.strip().replaceAll("\\s+", " ");
    }
}
