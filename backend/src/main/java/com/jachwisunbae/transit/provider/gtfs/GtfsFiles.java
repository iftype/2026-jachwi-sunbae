package com.jachwisunbae.transit.provider.gtfs;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import java.io.IOException;
import java.io.PushbackReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

public class GtfsFiles {

    private static final CSVFormat CSV = CSVFormat.DEFAULT.builder()
            .setHeader()
            .setSkipHeaderRecord(true)
            .get();
    private static final char BYTE_ORDER_MARK = '﻿';

    private final Path directory;

    public GtfsFiles(final Path directory) {
        this.directory = directory;
    }

    public <T> List<T> read(final String fileName, final Predicate<GtfsRecord> filter,
                            final Function<GtfsRecord, T> mapper) {
        List<T> rows = new ArrayList<>();
        forEach(fileName, record -> {
            if (filter.test(record)) {
                rows.add(mapper.apply(record));
            }
        });
        return rows;
    }

    // 람다 안에서 쓰도록 IOException을 UncheckedIOException으로 바꾼다. commons-csv도 행을 읽다 실패하면 같은 예외를 던진다.
    public void forEach(final String fileName, final Consumer<GtfsRecord> consumer) {
        try (CSVParser parser = open(directory.resolve(fileName))) {
            parser.forEach(row -> accept(fileName, row, consumer));
        } catch (IOException exception) {
            throw new UncheckedIOException(fileName + " 파일을 읽지 못했습니다.", exception);
        }
    }

    // 컬럼이 없거나 숫자·좌표·시간 값이 잘못된 행은 파일 이름과 줄 번호를 남기고 적재를 멈춘다.
    private void accept(final String fileName, final CSVRecord row, final Consumer<GtfsRecord> consumer) {
        try {
            consumer.accept(new GtfsRecord(row));
        } catch (IllegalArgumentException exception) {
            throw new InternalSystemException(ErrorCode.TRANSIT_FEED_READ_FAILURE,
                    fileName + " " + (row.getRecordNumber() + 1) + "번째 줄의 값이 올바르지 않습니다. "
                            + exception.getMessage(), exception);
        }
    }

    // UTF-8 BOM이 붙은 파일은 첫 헤더 이름에 BOM이 섞여 컬럼을 찾지 못하므로 건너뛴다.
    private CSVParser open(final Path path) throws IOException {
        PushbackReader reader = new PushbackReader(Files.newBufferedReader(path, StandardCharsets.UTF_8), 1);
        int firstCharacter = reader.read();
        if (firstCharacter != BYTE_ORDER_MARK && firstCharacter != -1) {
            reader.unread(firstCharacter);
        }
        return CSV.parse(reader);
    }
}
