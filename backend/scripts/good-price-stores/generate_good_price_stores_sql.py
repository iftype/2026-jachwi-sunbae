#!/usr/bin/env python3
"""행정안전부 착한가격업소 현황 CSV를 정제해 good_price_stores 적재 SQL을 만든다.

버스정류장 적재 스크립트와 같이 개발자 PC에서 한 번 실행하는 도구이다.
정제 규칙 자체가 데이터 정책이므로 저장소에 남긴다.

원본 값은 바꾸지 않는다. 앞뒤 공백 제거와 빈 값의 NULL 변환만 한다.
업종 재분류, 가격 숫자 변환, 전화번호 포맷 변경, 주소 보정은 하지 않는다.

원본에는 좌표가 없어 주소를 SGIS로 WGS84 좌표로 변환한다. 호출 규칙은 애플리케이션의 SgisAddressClient(#251)와 같다.
- 주소를 찾지 못하면(errCd -100) 그 행만 제외한다.
- 인증 실패는 개별 주소 문제가 아니므로 전체 작업을 중단한다.
- 5xx, timeout, SGIS 서버 오류(errCd -1)는 최대 3회 재시도하고, 그래도 실패하면 전체 작업을 중단한다.
- 서버 오류(errCd -1)는 특정 주소에서 매번 나기도 한다 (예: 구 없이 적은 "경기도 안양시 흥안대로 415").
  같은 주소로 재시도하고 토큰을 새로 발급해도 계속되면 그 행만 제외한다.
  연속으로 여러 주소에서 계속되면 장애로 보고 전체 작업을 중단한다.
- 주소 변환은 여러 요청을 동시에 보낸다 (--workers, 기본 4).
- 변환 결과는 캐시 파일에 바로 기록한다. 중간에 중단되어도 다시 실행하면 이미 변환한 주소는 SGIS를 호출하지 않는다.
  외부 장애로 정상 데이터가 조용히 빠진 SQL이 만들어지는 것을 막는다.

생성한 SQL은 한 트랜잭션 안에서 good_price_stores를 비우고 다시 채운다.
SQL 파일은 저장소에 커밋하지 않는다.

사용법:
    export SGIS_CONSUMER_KEY=... SGIS_CONSUMER_SECRET=...
    python3 generate_good_price_stores_sql.py <CSV 경로> --source-date 2026-06-30 --output <SQL 경로>

로컬 개발용 샘플 (기준 좌표 주변만, 버스정류장 샘플과 같은 지역):
    python3 generate_good_price_stores_sql.py <CSV 경로> --source-date 2026-06-30 --output <SQL 경로> \
        --around 37.3948,127.1119 --around 37.5665,126.978 --around 37.4841234,126.9291234 --around-meters 2500

테스트:
    cd backend/scripts/good-price-stores && python3 -m unittest
"""

import argparse
import csv
import json
import math
import os
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

SOURCE_NAME = "행정안전부 착한가격업소 현황"

# 국내 좌표 범위. 좌표 변환 결과가 이 범위를 벗어나면 잘못 변환된 것으로 본다.
KOREA_LATITUDE = (Decimal("33"), Decimal("39"))
KOREA_LONGITUDE = (Decimal("124"), Decimal("132"))

# DECIMAL(10, 7), DECIMAL(11, 7)에 맞춰 소수 7자리로 반올림한다.
COORDINATE_SCALE = Decimal("0.0000001")

MENU_COUNT = 4

# 위도 1도의 거리(m). 샘플 지역의 위경도 범위를 계산할 때 쓴다.
METERS_PER_LATITUDE_DEGREE = 111_320

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
# HTTP 200으로 오지만 SGIS 내부 처리 오류다. 같은 주소로 다시 요청하면 성공하는 일시 장애라 재시도한다.
SGIS_SERVER_ERROR = -1
SGIS_MAX_RETRIES = 3
SGIS_TIMEOUT_SECONDS = 5
# 토큰 유효시간(4시간)이 끝나기 직전에 호출이 실패하지 않도록 미리 새로 발급한다.
SGIS_TOKEN_REFRESH_MARGIN_SECONDS = 5 * 60

PROGRESS_INTERVAL = 500
# 서버 오류로 제외한 주소가 연달아 이만큼 나오면 주소 문제가 아니라 장애로 보고 중단한다.
MAX_CONSECUTIVE_ADDRESS_ERRORS = 10


class InvalidCsv(Exception):
    """CSV 파일 자체가 예상과 달라 전체 작업을 중단해야 하는 경우."""


class InvalidRow(Exception):
    """행 하나의 문제. 그 행만 제외하고 계속한다."""


class SgisAddressError(InvalidRow):
    """재시도와 토큰 재발급 후에도 SGIS가 이 주소에서 서버 오류(errCd -1)를 응답하는 경우."""

    def __init__(self):
        super().__init__("sgis server error")


class SgisError(Exception):
    """SGIS 인증 실패나 장애. 전체 작업을 중단한다."""


class SgisServerError(SgisError):
    """재시도 후에도 SGIS 서버 오류(errCd -1)가 계속되는 경우."""


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
    parser.add_argument("--around", type=coordinate_pair, action="append", default=[],
                        metavar="위도,경도", help="이 좌표 주변 업소만 SQL에 넣는다. 여러 번 쓸 수 있다")
    parser.add_argument("--around-meters", type=int, default=2500,
                        help="--around 기준 좌표에서 위아래·좌우로 포함할 거리(m)")
    parser.add_argument("--workers", type=int, default=4, help="동시에 보낼 SGIS 요청 수 (기본: 4)")
    parser.add_argument("--cache", type=Path,
                        help="좌표 변환 결과 캐시 파일 (기본: <output>.geocode-cache.jsonl). 다시 실행하면 이어서 변환한다")
    args = parser.parse_args()

    consumer_key = os.environ.get("SGIS_CONSUMER_KEY", "").strip()
    consumer_secret = os.environ.get("SGIS_CONSUMER_SECRET", "").strip()
    if not consumer_key or not consumer_secret:
        sys.exit("SGIS_CONSUMER_KEY와 SGIS_CONSUMER_SECRET 환경변수가 필요합니다.")

    try:
        rows = read_rows(args.csv_path, args.encoding)
        cache_path = args.cache or args.output.with_name(args.output.name + ".geocode-cache.jsonl")
        geocoder = CachedGeocoder(SgisGeocoder(consumer_key, consumer_secret), cache_path)
        geocode_all(rows, geocoder, args.workers)
        result = build_stores(rows, geocoder)
    except (InvalidCsv, SgisError) as exception:
        sys.exit("작업을 중단합니다: " + str(exception))
    stores = result.stores
    if args.around:
        areas = [area(center, args.around_meters) for center in args.around]
        stores = [store for store in stores if any(contains(bounds, store) for bounds in areas)]
    write_sql(args.output, stores, args.batch_size, args.source_date, args.around, args.around_meters)
    print_summary(result, args.source_date, args.output)
    if args.around:
        print("sample rows      : {:,}".format(len(stores)))


def coordinate_pair(value):
    try:
        latitude, longitude = (Decimal(part.strip()) for part in value.split(","))
    except (ValueError, InvalidOperation):
        raise argparse.ArgumentTypeError("'위도,경도' 형식이어야 합니다: " + value)
    return latitude, longitude


def area(center, meters):
    latitude, longitude = center
    latitude_delta = Decimal(meters / METERS_PER_LATITUDE_DEGREE)
    longitude_delta = Decimal(meters / (METERS_PER_LATITUDE_DEGREE * math.cos(math.radians(latitude))))
    return (latitude - latitude_delta, latitude + latitude_delta,
            longitude - longitude_delta, longitude + longitude_delta)


def contains(bounds, store):
    min_latitude, max_latitude, min_longitude, max_longitude = bounds
    return (min_latitude <= store["latitude"] <= max_latitude
            and min_longitude <= store["longitude"] <= max_longitude)


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


def geocode_all(rows, geocode, workers):
    """필수 값이 있는 행의 주소를 동시에 변환해 둔다. 장애가 나면 남은 요청을 취소하고 중단한다."""
    addresses = list(dict.fromkeys(store["address"] for store in valid_stores(rows)))
    executor = ThreadPoolExecutor(max_workers=workers)
    consecutive_address_errors = 0
    try:
        futures = [executor.submit(geocode, address) for address in addresses]
        for done, future in enumerate(as_completed(futures), start=1):
            try:
                future.result()
                consecutive_address_errors = 0
            except SgisAddressError:
                consecutive_address_errors += 1
                if consecutive_address_errors >= MAX_CONSECUTIVE_ADDRESS_ERRORS:
                    raise SgisError("SGIS 서버 오류가 주소 {}개에서 연달아 발생했습니다.".format(
                        MAX_CONSECUTIVE_ADDRESS_ERRORS))
            if done % PROGRESS_INTERVAL == 0 or done == len(addresses):
                print("진행: {:,} / {:,} 주소".format(done, len(addresses)), file=sys.stderr)
    except BaseException:
        executor.shutdown(wait=True, cancel_futures=True)
        raise
    executor.shutdown(wait=True)


def valid_stores(rows):
    for _, row in rows:
        try:
            yield parse_store(row)
        except InvalidRow:
            continue


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
        # 여러 스레드가 동시에 토큰을 발급하지 않도록 막는다.
        self.token_lock = threading.Lock()

    def __call__(self, address):
        try:
            root = self.geocode(address)
        except SgisServerError:
            # 같은 토큰으로 재시도해도 서버 오류가 계속되면 토큰을 새로 발급해 한 번 더 시도한다.
            # 그래도 계속되면 이 주소의 문제로 보고 그 행만 제외한다.
            print("WARN sgis server error persists, reissuing token address={}".format(address), file=sys.stderr)
            self.invalidate_token()
            try:
                root = self.geocode(address)
            except SgisServerError:
                raise SgisAddressError()
        if error_code(root) == SGIS_INVALID_TOKEN:
            # 만료 시각 전이라도 SGIS가 토큰을 거부하면 한 번만 새로 발급해 다시 요청한다.
            self.invalidate_token()
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
        with self.token_lock:
            if self.token is None or self.token_expires_at - SGIS_TOKEN_REFRESH_MARGIN_SECONDS <= self.clock():
                self.issue_token()
            return self.token

    def invalidate_token(self):
        with self.token_lock:
            self.token = None

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
                root = self.request(url)
                if error_code(root) != SGIS_SERVER_ERROR:
                    return root
                failure = "errCd {} {}".format(root.get("errCd"), root.get("errMsg"))
            except urllib.error.HTTPError as exception:
                if exception.code < 500:
                    raise SgisError("SGIS HTTP {} ({})".format(exception.code, path))
                failure = "HTTP {}".format(exception.code)
            except (urllib.error.URLError, socket.timeout) as exception:
                failure = str(exception)
            if attempt < SGIS_MAX_RETRIES:
                print("WARN sgis retry attempt={} reason={}".format(attempt + 1, failure), file=sys.stderr)
                self.sleep(2 ** attempt)
        message = "SGIS 요청이 {}회 재시도 후에도 실패했습니다: {}".format(SGIS_MAX_RETRIES, failure)
        if failure.startswith("errCd"):
            raise SgisServerError(message)
        raise SgisError(message)


class CachedGeocoder:
    """좌표 변환 결과를 JSON Lines 파일에 바로 기록하고, 이미 변환한 주소는 다시 호출하지 않는다.

    주소를 찾지 못한 결과(None)도 기록한다. SGIS 장애로 중단된 주소는 기록하지 않으므로 다시 실행하면 재시도한다.
    """

    def __init__(self, geocode, path):
        self.geocode = geocode
        self.path = path
        self.results = {}
        # 서버 오류로 실패한 주소. 다시 실행하면 재시도하도록 파일에는 기록하지 않는다.
        self.address_errors = set()
        # 여러 스레드가 동시에 결과를 기록하므로 캐시 갱신과 파일 쓰기를 한 번에 하나씩 한다.
        self.lock = threading.Lock()
        if path.exists():
            with path.open(encoding="utf-8") as file:
                for line in file:
                    if line.strip():
                        entry = json.loads(line)
                        self.results[entry["address"]] = entry["coordinate"]
            print("캐시에서 {:,}개 주소를 불러왔습니다: {}".format(len(self.results), path), file=sys.stderr)

    def __call__(self, address):
        with self.lock:
            if address in self.results:
                coordinate = self.results[address]
                return tuple(coordinate) if coordinate is not None else None
            if address in self.address_errors:
                raise SgisAddressError()
        try:
            coordinate = self.geocode(address)
        except SgisAddressError:
            with self.lock:
                self.address_errors.add(address)
            raise
        entry = list(coordinate) if coordinate is not None else None
        with self.lock:
            self.results[address] = entry
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as file:
                file.write(json.dumps({"address": address, "coordinate": entry}, ensure_ascii=False) + "\n")
        return coordinate


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


def write_sql(output, stores, batch_size, source_date, centers=(), around_meters=None):
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as file:
        file.write("-- 원본: {} ({})\n".format(SOURCE_NAME, source_date.isoformat()))
        for latitude, longitude in centers:
            file.write("-- 샘플 지역: {},{} 주변 {}m\n".format(latitude, longitude, around_meters))
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
