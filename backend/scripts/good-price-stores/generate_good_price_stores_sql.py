#!/usr/bin/env python3
"""행정안전부 착한가격업소 현황 CSV를 정제해 good_price_stores 적재 SQL을 만든다.

버스정류장 적재 스크립트와 같이 개발자 PC에서 한 번 실행하는 도구이다.
정제 규칙 자체가 데이터 정책이므로 저장소에 남긴다.

원본 값은 바꾸지 않는다. 앞뒤 공백 제거와 빈 값의 NULL 변환만 한다.
업종 재분류, 가격 숫자 변환, 전화번호 포맷 변경, 주소 보정은 하지 않는다.

원본에는 좌표가 없어 주소를 좌표로 변환해야 한다.
좌표 변환은 build_stores에 함수로 넘긴다. 함수는 (위도, 경도)를 반환하고, 주소를 찾지 못하면 None을 반환한다.
그 외 예외(인증 실패, 외부 장애 등)는 잡지 않고 전체 작업을 중단한다.

생성한 SQL은 한 트랜잭션 안에서 good_price_stores를 비우고 다시 채운다.
SQL 파일은 저장소에 커밋하지 않는다.

테스트:
    cd backend/scripts/good-price-stores && python3 -m unittest
"""

import csv
import sys
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal

SOURCE_NAME = "행정안전부 착한가격업소 현황"

# 국내 좌표 범위. 좌표 변환 결과가 이 범위를 벗어나면 잘못 변환된 것으로 본다.
KOREA_LATITUDE = (Decimal("33"), Decimal("39"))
KOREA_LONGITUDE = (Decimal("124"), Decimal("132"))

# DECIMAL(10, 7), DECIMAL(11, 7)에 맞춰 소수 7자리로 반올림한다.
COORDINATE_SCALE = Decimal("0.0000001")

MENU_COUNT = 4

# good_price_stores 컬럼: (CSV 컬럼, 최대 길이, 필수 여부)
COLUMNS = {
    "province": ("시도", 30, True),
    "district": ("시군", 30, False),
    "business_type": ("업종", 30, True),
    "name": ("업소명", 100, True),
    "phone": ("연락처", 30, False),
    "address": ("주소", 255, True),
}
for index in range(1, MENU_COUNT + 1):
    COLUMNS["menu_name_" + str(index)] = ("메뉴" + str(index), 100, False)
    COLUMNS["menu_price_" + str(index)] = ("가격" + str(index), 100, False)

INSERT_COLUMNS = ["province", "district", "business_type", "name", "phone", "address", "latitude", "longitude"] \
    + ["menu_{}_{}".format(kind, index) for index in range(1, MENU_COUNT + 1) for kind in ("name", "price")] \
    + ["source_date"]

# 빈 값으로 보는 문자열. 원본을 다른 도구로 저장하면서 들어간 값을 거른다.
EMPTY_VALUES = {"", "nan", "NaN", "NAN"}


class InvalidCsv(Exception):
    """CSV 파일 자체가 예상과 달라 전체 작업을 중단해야 하는 경우."""


class InvalidRow(Exception):
    """행 하나의 문제. 그 행만 제외하고 계속한다."""


class ImportResult:

    def __init__(self):
        self.total = 0
        self.stores = []
        self.invalid_rows = []
        self.geocode_failed = []
        self.duplicates = []

    @property
    def skipped(self):
        return len(self.invalid_rows) + len(self.geocode_failed)


def validate_columns(fieldnames):
    missing = [header for header, _, _ in COLUMNS.values() if header not in (fieldnames or [])]
    if missing:
        raise InvalidCsv("CSV에 필요한 컬럼이 없습니다: " + ", ".join(missing))


def read_rows(csv_path, encoding):
    with csv_path.open(encoding=encoding, newline="") as file:
        reader = csv.DictReader(file)
        validate_columns(reader.fieldnames)
        return [(line_number, row) for line_number, row in enumerate(reader, start=2)]


def clean(value):
    if value is None:
        return None
    value = value.strip()
    if value in EMPTY_VALUES:
        return None
    return value


def parse_store(row):
    store = {}
    for column, (header, max_length, required) in COLUMNS.items():
        value = clean(row.get(header))
        if value is None and required:
            raise InvalidRow("missing " + header)
        if value is not None and len(value) > max_length:
            raise InvalidRow("too long " + header)
        store[column] = value
    return store


def build_stores(rows, geocode):
    result = ImportResult()
    seen = set()
    for line_number, row in rows:
        result.total += 1
        try:
            store = parse_store(row)
        except InvalidRow as exception:
            result.invalid_rows.append((line_number, str(exception), row))
            warn("invalid row", line_number, str(exception), row)
            continue

        try:
            store["latitude"], store["longitude"] = coordinate(geocode(store["address"]))
        except InvalidRow as exception:
            result.geocode_failed.append((line_number, str(exception), row))
            warn("geocoding failed", line_number, str(exception), row)
            continue

        key = (store["name"], store["address"])
        if key in seen:
            result.duplicates.append((line_number, "duplicate name and address", row))
            warn("duplicate store", line_number, "duplicate name and address", row)
        seen.add(key)
        result.stores.append(store)
    return result


def coordinate(geocoded):
    if geocoded is None:
        raise InvalidRow("no result")
    latitude, longitude = (Decimal(str(value)) for value in geocoded)
    if not (KOREA_LATITUDE[0] <= latitude <= KOREA_LATITUDE[1]
            and KOREA_LONGITUDE[0] <= longitude <= KOREA_LONGITUDE[1]):
        raise InvalidRow("out of korea")
    return (latitude.quantize(COORDINATE_SCALE, rounding=ROUND_HALF_UP),
            longitude.quantize(COORDINATE_SCALE, rounding=ROUND_HALF_UP))


def warn(title, line_number, reason, row):
    print("WARN {} row={} reason={} name={} address={}".format(
        title, line_number, reason, clean(row.get("업소명")), clean(row.get("주소"))), file=sys.stderr)


def write_sql(output, stores, batch_size, source_date):
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as file:
        file.write("-- 원본: {} ({})\n".format(SOURCE_NAME, source_date.isoformat()))
        file.write("-- 적재 행 수: {}\n".format(len(stores)))
        file.write("SET NAMES utf8mb4;\n")
        file.write("START TRANSACTION;\n")
        file.write("DELETE FROM good_price_stores;\n")
        for start in range(0, len(stores), batch_size):
            batch = stores[start:start + batch_size]
            file.write("INSERT INTO good_price_stores ({}) VALUES\n".format(", ".join(INSERT_COLUMNS)))
            file.write(",\n".join(values(store, source_date) for store in batch))
            file.write(";\n")
        file.write("COMMIT;\n")


def values(store, source_date):
    row = dict(store, source_date=source_date.isoformat())
    return "(" + ", ".join(
        str(row[column]) if column in ("latitude", "longitude") else quote(row[column])
        for column in INSERT_COLUMNS) + ")"


def quote(value):
    if value is None:
        return "NULL"
    escaped = (value.replace("\\", "\\\\")
               .replace("'", "''")
               .replace("\n", "\\n")
               .replace("\r", "\\r")
               .replace("\0", "\\0"))
    return "'" + escaped + "'"


def print_summary(result, source_date, output):
    print("=== Good Price Store Import Summary ===")
    print()
    print("source           : " + SOURCE_NAME)
    print("source date      : " + source_date.isoformat())
    print()
    print("total rows       : {:,}".format(result.total))
    print("generated rows   : {:,}".format(len(result.stores)))
    print("skipped rows     : {:,}".format(result.skipped))
    print()
    print("invalid rows     : {:,}".format(len(result.invalid_rows)))
    print_reasons(result.invalid_rows)
    print("geocode failed   : {:,}".format(len(result.geocode_failed)))
    print_reasons(result.geocode_failed)
    print("duplicates found : {:,}".format(len(result.duplicates)))
    print()
    print("output:")
    print(str(output))


def print_reasons(skipped):
    for reason, count in Counter(reason for _, reason, _ in skipped).most_common():
        print("  - {}: {:,}".format(reason, count))
