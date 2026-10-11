#!/usr/bin/env python3
"""행정안전부 착한가격업소 현황 CSV를 정제해 good_price_stores 적재 SQL을 만든다.

버스정류장 적재 스크립트와 같이 개발자 PC에서 한 번 실행하는 도구이다.
정제 규칙 자체가 데이터 정책이므로 저장소에 남긴다.

원본 값은 바꾸지 않는다. 앞뒤 공백 제거와 빈 값의 NULL 변환만 한다.
업종 재분류, 가격 숫자 변환, 전화번호 포맷 변경, 주소 보정은 하지 않는다.

원본에는 좌표가 없어 주소를 SGIS로 WGS84 좌표로 변환한다. 호출 규칙은 애플리케이션의 SgisAddressClient(#251)와 같다.
- 주소를 찾지 못하면(errCd -100) 그 행만 제외한다.
- 인증 실패는 개별 주소 문제가 아니므로 전체 작업을 중단한다.
- 5xx, timeout은 최대 3회 재시도하고, 그래도 실패하면 전체 작업을 중단한다.
  외부 장애로 정상 데이터가 조용히 빠진 SQL이 만들어지는 것을 막는다.

생성한 SQL은 한 트랜잭션 안에서 good_price_stores를 비우고 다시 채운다.
SQL 파일은 저장소에 커밋하지 않는다.

사용법:
    export SGIS_CONSUMER_KEY=... SGIS_CONSUMER_SECRET=...
    python3 generate_good_price_stores_sql.py <CSV 경로> --source-date 2026-06-30 --output <SQL 경로>

테스트:
    cd backend/scripts/good-price-stores && python3 -m unittest
"""

import argparse
import csv
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

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

SGIS_BASE_URL = "https://sgisapi.mods.go.kr"
SGIS_SUCCESS = 0
SGIS_NO_RESULT = -100
SGIS_INVALID_TOKEN = -401
SGIS_MAX_RETRIES = 3
SGIS_TIMEOUT_SECONDS = 5
# 토큰 유효시간(4시간)이 끝나기 직전에 호출이 실패하지 않도록 미리 새로 발급한다.
SGIS_TOKEN_REFRESH_MARGIN_SECONDS = 5 * 60

PROGRESS_INTERVAL = 500


class InvalidCsv(Exception):
    """CSV 파일 자체가 예상과 달라 전체 작업을 중단해야 하는 경우."""


class InvalidRow(Exception):
    """행 하나의 문제. 그 행만 제외하고 계속한다."""


class SgisError(Exception):
    """SGIS 인증 실패나 장애. 전체 작업을 중단한다."""


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


def main():
    parser = argparse.ArgumentParser(description="착한가격업소 CSV로 good_price_stores 적재 SQL을 만든다.")
    parser.add_argument("csv_path", type=Path, help="행정안전부 착한가격업소 현황 CSV")
    parser.add_argument("--output", type=Path, required=True, help="생성할 SQL 파일 경로")
    parser.add_argument("--source-date", type=date.fromisoformat, required=True,
                        metavar="YYYY-MM-DD", help="공공데이터 기준일")
    parser.add_argument("--encoding", default="cp949", help="CSV 인코딩 (기본: cp949)")
    parser.add_argument("--batch-size", type=int, default=1000, help="INSERT 한 문장에 넣을 행 수")
    args = parser.parse_args()

    consumer_key = os.environ.get("SGIS_CONSUMER_KEY", "").strip()
    consumer_secret = os.environ.get("SGIS_CONSUMER_SECRET", "").strip()
    if not consumer_key or not consumer_secret:
        sys.exit("SGIS_CONSUMER_KEY와 SGIS_CONSUMER_SECRET 환경변수가 필요합니다.")

    try:
        rows = read_rows(args.csv_path, args.encoding)
        result = build_stores(rows, SgisGeocoder(consumer_key, consumer_secret), progress=True)
    except (InvalidCsv, SgisError) as exception:
        sys.exit("작업을 중단합니다: " + str(exception))
    write_sql(args.output, result.stores, args.batch_size, args.source_date)
    print_summary(result, args.source_date, args.output)


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


def build_stores(rows, geocode, progress=False):
    result = ImportResult()
    seen = set()
    for line_number, row in rows:
        result.total += 1
        if progress and result.total % PROGRESS_INTERVAL == 0:
            print("진행: {:,} / {:,}".format(result.total, len(rows)), file=sys.stderr)
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


class SgisGeocoder:
    """주소를 SGIS로 WGS84 (위도, 경도)로 변환한다. 주소를 찾지 못하면 None을 반환한다."""

    def __init__(self, consumer_key, consumer_secret, request=None, clock=time.time, sleep=time.sleep):
        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret
        self.request = request or request_json
        self.clock = clock
        self.sleep = sleep
        self.token = None
        self.token_expires_at = 0

    def __call__(self, address):
        root = self.geocode(address)
        if error_code(root) == SGIS_INVALID_TOKEN:
            # 만료 시각 전이라도 SGIS가 토큰을 거부하면 한 번만 새로 발급해 다시 요청한다.
            self.token = None
            root = self.geocode(address)
        if error_code(root) == SGIS_NO_RESULT:
            return None
        require_success(root, "SGIS 주소 요청")

        # SGIS 응답의 x는 경도, y는 위도다.
        first = (root.get("result") or {}).get("resultdata") or [{}]
        latitude, longitude = first[0].get("y"), first[0].get("x")
        if not latitude or not longitude:
            return None
        return latitude, longitude

    def geocode(self, address):
        return self.get("/OpenAPI3/addr/geocodewgs84.json",
                        {"accessToken": self.access_token(), "address": address, "resultcount": 1})

    def access_token(self):
        if self.token is None or self.token_expires_at - SGIS_TOKEN_REFRESH_MARGIN_SECONDS <= self.clock():
            self.issue_token()
        return self.token

    def issue_token(self):
        root = self.get("/OpenAPI3/auth/authentication.json",
                        {"consumer_key": self.consumer_key, "consumer_secret": self.consumer_secret})
        require_success(root, "SGIS 토큰 발급")
        result = root.get("result") or {}
        if not result.get("accessToken") or not result.get("accessTimeout"):
            raise SgisError("SGIS 토큰 발급 응답에 토큰이 없습니다.")
        self.token = result["accessToken"]
        # 만료 시각(accessTimeout)은 epoch 밀리초로 온다.
        self.token_expires_at = int(result["accessTimeout"]) / 1000

    def get(self, path, params):
        url = SGIS_BASE_URL + path + "?" + urllib.parse.urlencode(params)
        for attempt in range(SGIS_MAX_RETRIES + 1):
            try:
                return self.request(url)
            except urllib.error.HTTPError as exception:
                if exception.code < 500:
                    raise SgisError("SGIS HTTP {} ({})".format(exception.code, path))
                failure = "HTTP {}".format(exception.code)
            except (urllib.error.URLError, socket.timeout) as exception:
                failure = str(exception)
            if attempt < SGIS_MAX_RETRIES:
                print("WARN sgis retry attempt={} reason={}".format(attempt + 1, failure), file=sys.stderr)
                self.sleep(2 ** attempt)
        raise SgisError("SGIS 요청이 {}회 재시도 후에도 실패했습니다: {}".format(SGIS_MAX_RETRIES, failure))


def request_json(url):
    with urllib.request.urlopen(url, timeout=SGIS_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def error_code(root):
    try:
        return int(root.get("errCd"))
    except (TypeError, ValueError):
        return None


def require_success(root, action):
    if error_code(root) != SGIS_SUCCESS:
        raise SgisError("{}이 실패했습니다. errCd={}, errMsg={}".format(action, root.get("errCd"), root.get("errMsg")))


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


if __name__ == "__main__":
    main()
