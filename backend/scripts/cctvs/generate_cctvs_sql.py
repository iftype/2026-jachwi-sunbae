#!/usr/bin/env python3
"""전국CCTV표준데이터 CSV를 정제해 cctvs 적재 SQL을 만든다.

버스정류장, 착한가격업소 적재 스크립트와 같이 개발자 PC에서 한 번 실행하는 도구이다.
정제 규칙 자체가 데이터 정책이므로 저장소에 남긴다.

원본에 WGS84 위도·경도가 있어 좌표 변환은 하지 않는다.
대신 위치를 믿기 어려운 행은 고치지 않고 제외한다. 위에서부터 판단하고, 한 행은 처음 걸린 이유 하나로만 센다.
1. 필수 값 (관리번호, 주소, 설치목적, 카메라대수, 위도, 경도)이 없다. 주소는 도로명과 지번이 모두 없을 때만 없다고 본다.
2. 값이 컬럼 길이를 넘는다.
3. 위도·경도·카메라대수가 숫자가 아니다.
4. 국내 범위 (위도 33~39, 경도 124~132) 밖이다. 뒤집힌 위경도를 고치지 않는다.
5. 지자체가 일괄 입력한 가짜 좌표다 (FAKE_COORDINATES).
6. 원본 문자열 기준 위도나 경도가 소수 2자리 이하다. 오차가 약 1km라 위치를 믿기 어렵다.
7. 카메라대수가 0이다.
8. 설치목적이 PURPOSES 중 하나가 아니다.

화소수와 보관일수는 비어 있는 행이 많아 행을 제외하지 않고 값만 NULL로 바꾼다.
- 화소수: 비어 있거나, 숫자가 아니거나, 100 미만이다. 대부분 200 (200만 화소) 단위인데 2, 4, 41처럼 단위가 다른 값이 섞여 있다.
- 보관일수: 비어 있거나, 숫자가 아니거나, 0이다.

주소는 도로명주소를 쓰고, 없으면 지번주소를 쓴다. 설치목적은 원본 문자열 그대로 저장한다.
cctvs.management_number에 UNIQUE 제약이 있으므로, 적재할 행에 관리번호가 중복되면 SQL을 만들지 않고 전체 작업을 중단한다.

생성한 SQL은 한 트랜잭션 안에서 cctvs를 비우고 다시 채운다.
SQL 파일은 저장소에 커밋하지 않는다.

사용법:
    python3 generate_cctvs_sql.py <CSV 경로> --output <SQL 경로>

로컬 개발용 샘플 (기준 좌표 주변만, 버스정류장·착한가격업소 샘플과 같은 지역):
    python3 generate_cctvs_sql.py <CSV 경로> --output <SQL 경로> \
        --around 37.3948,127.1119 --around 37.5665,126.978 --around 37.4841234,126.9291234 --around-meters 2500

테스트:
    cd backend/scripts/cctvs && python3 -m unittest
"""

import argparse
import csv
import math
import sys
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

SOURCE_NAME = "전국CCTV표준데이터"

# 국내 좌표 범위. 이 범위를 벗어나면 잘못 입력된 좌표로 본다.
KOREA_LATITUDE = (Decimal("33"), Decimal("39"))
KOREA_LONGITUDE = (Decimal("124"), Decimal("132"))

# 지자체가 실제 위치 대신 일괄 입력한 좌표 (위도, 경도).
# 공주시 (36.00000, 127.00000), 대전 대덕구 (36.1, 127.1), 예천군 (36.000100, 128.000100)
FAKE_COORDINATES = {
    (Decimal("36"), Decimal("127")),
    (Decimal("36.1"), Decimal("127.1")),
    (Decimal("36.0001"), Decimal("128.0001")),
}

# 원본 위도·경도의 소수 자릿수가 이 값 이하면 정밀도가 낮은 좌표로 본다.
MIN_COORDINATE_DECIMALS = 3

# DECIMAL(10, 7), DECIMAL(11, 7)에 맞춰 소수 7자리로 반올림한다.
COORDINATE_SCALE = Decimal("0.0000001")

# 이보다 작은 화소수는 단위가 달라 (예: 2 = 2MP) 의미를 확정할 수 없으므로 NULL로 저장한다.
MIN_CAMERA_PIXELS = 100

# 설치목적구분 원본 값. API 코드 변환은 애플리케이션의 CctvPurpose가 한다.
PURPOSES = {"생활방범", "다목적", "어린이보호", "교통단속", "시설물관리",
            "재난재해", "차량방범", "쓰레기단속", "기타", "교통정보수집"}

# 위도 1도의 거리(m). 샘플 지역의 위경도 범위를 계산할 때 쓴다.
METERS_PER_LATITUDE_DEGREE = 111_320

MANAGEMENT_NUMBER = "관리번호"
ROAD_ADDRESS = "소재지도로명주소"
LOT_ADDRESS = "소재지지번주소"
PURPOSE = "설치목적구분"
CAMERA_COUNT = "카메라대수"
CAMERA_PIXELS = "카메라화소수"
RETENTION_DAYS = "보관일수"
LATITUDE = "WGS84위도"
LONGITUDE = "WGS84경도"

REQUIRED_HEADERS = [MANAGEMENT_NUMBER, ROAD_ADDRESS, LOT_ADDRESS, PURPOSE, CAMERA_COUNT,
                    CAMERA_PIXELS, RETENTION_DAYS, LATITUDE, LONGITUDE]

# cctvs 문자열 컬럼의 최대 길이
MAX_LENGTHS = {"management_number": 30, "address": 255, "purpose": 20}

INSERT_COLUMNS = ["management_number", "address", "purpose", "camera_count",
                  "camera_pixels", "retention_days", "latitude", "longitude"]

# 제외 이유. summary에 이 순서로 출력한다.
MISSING_VALUE = "missing value"
TOO_LONG = "too long"
INVALID_NUMBER = "invalid number"
OUT_OF_KOREA = "out of korea"
FAKE_COORDINATE = "fake coordinate"
LOW_PRECISION = "low precision"
ZERO_CAMERA = "zero camera"
UNKNOWN_PURPOSE = "unknown purpose"
SKIP_REASONS = [MISSING_VALUE, TOO_LONG, INVALID_NUMBER, OUT_OF_KOREA,
                FAKE_COORDINATE, LOW_PRECISION, ZERO_CAMERA, UNKNOWN_PURPOSE]

# 빈 값으로 보는 문자열. 원본을 다른 도구로 저장하면서 들어간 값을 거른다.
EMPTY_VALUES = {"", "nan", "NaN", "NAN"}


class InvalidCsv(Exception):
    """CSV 파일 자체가 예상과 달라 전체 작업을 중단해야 하는 경우."""


class InvalidRow(Exception):
    """행 하나의 문제. 그 행만 제외하고 계속한다."""

    def __init__(self, reason, detail=None):
        super().__init__(reason if detail is None else "{} ({})".format(reason, detail))
        self.reason = reason


class ImportResult:

    def __init__(self):
        self.total = 0
        self.cctvs = []
        self.skipped = []
        self.nulled_pixels = 0
        self.nulled_retention = 0

    def skipped_count(self, reason):
        return sum(1 for _, skipped_reason, _ in self.skipped if skipped_reason == reason)


def main():
    parser = argparse.ArgumentParser(description="전국CCTV표준데이터 CSV로 cctvs 적재 SQL을 만든다.")
    parser.add_argument("csv_path", type=Path, help="전국CCTV표준데이터 CSV")
    parser.add_argument("--output", type=Path, required=True, help="생성할 SQL 파일 경로")
    parser.add_argument("--encoding", default="cp949", help="CSV 인코딩 (기본: cp949)")
    parser.add_argument("--batch-size", type=int, default=1000, help="INSERT 한 문장에 넣을 행 수")
    parser.add_argument("--around", type=coordinate_pair, action="append", default=[],
                        metavar="위도,경도", help="이 좌표 주변 CCTV만 SQL에 넣는다. 여러 번 쓸 수 있다")
    parser.add_argument("--around-meters", type=int, default=2500,
                        help="--around 기준 좌표에서 위아래·좌우로 포함할 거리(m)")
    args = parser.parse_args()

    try:
        result = build_cctvs(read_rows(args.csv_path, args.encoding))
    except InvalidCsv as exception:
        sys.exit("작업을 중단합니다: " + str(exception))
    cctvs = result.cctvs
    if args.around:
        areas = [area(center, args.around_meters) for center in args.around]
        cctvs = [cctv for cctv in cctvs if any(contains(bounds, cctv) for bounds in areas)]
    write_sql(args.output, cctvs, args.batch_size, args.around, args.around_meters)
    print_summary(result, args.output)
    if args.around:
        print("sample rows       : {:,}".format(len(cctvs)))


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


def contains(bounds, cctv):
    min_latitude, max_latitude, min_longitude, max_longitude = bounds
    return (min_latitude <= cctv["latitude"] <= max_latitude
            and min_longitude <= cctv["longitude"] <= max_longitude)


def validate_columns(fieldnames):
    missing = [header for header in REQUIRED_HEADERS if header not in (fieldnames or [])]
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


def build_cctvs(rows):
    result = ImportResult()
    first_lines = {}
    for line_number, row in rows:
        result.total += 1
        try:
            cctv = parse_cctv(row)
        except InvalidRow as exception:
            result.skipped.append((line_number, exception.reason, row))
            warn(line_number, str(exception), row)
            continue

        number = cctv["management_number"]
        if number in first_lines:
            raise InvalidCsv("관리번호가 중복됩니다: {} (row={}, row={})".format(
                number, first_lines[number], line_number))
        first_lines[number] = line_number

        if cctv["camera_pixels"] is None:
            result.nulled_pixels += 1
        if cctv["retention_days"] is None:
            result.nulled_retention += 1
        result.cctvs.append(cctv)
    return result


def parse_cctv(row):
    management_number = clean(row.get(MANAGEMENT_NUMBER))
    address = clean(row.get(ROAD_ADDRESS)) or clean(row.get(LOT_ADDRESS))
    purpose = clean(row.get(PURPOSE))
    raw_camera_count = clean(row.get(CAMERA_COUNT))
    raw_latitude = clean(row.get(LATITUDE))
    raw_longitude = clean(row.get(LONGITUDE))

    for header, value in [(MANAGEMENT_NUMBER, management_number), ("주소", address), (PURPOSE, purpose),
                          (CAMERA_COUNT, raw_camera_count), (LATITUDE, raw_latitude), (LONGITUDE, raw_longitude)]:
        if value is None:
            raise InvalidRow(MISSING_VALUE, header)
    for column, value in [("management_number", management_number), ("address", address), ("purpose", purpose)]:
        if len(value) > MAX_LENGTHS[column]:
            raise InvalidRow(TOO_LONG, column)

    latitude = decimal_or_none(raw_latitude)
    longitude = decimal_or_none(raw_longitude)
    camera_count = int_or_none(raw_camera_count)
    if latitude is None or longitude is None or camera_count is None:
        raise InvalidRow(INVALID_NUMBER)
    if not (KOREA_LATITUDE[0] <= latitude <= KOREA_LATITUDE[1]
            and KOREA_LONGITUDE[0] <= longitude <= KOREA_LONGITUDE[1]):
        raise InvalidRow(OUT_OF_KOREA)
    if (latitude, longitude) in FAKE_COORDINATES:
        raise InvalidRow(FAKE_COORDINATE)
    if min(decimal_places(latitude), decimal_places(longitude)) < MIN_COORDINATE_DECIMALS:
        raise InvalidRow(LOW_PRECISION)
    if camera_count == 0:
        raise InvalidRow(ZERO_CAMERA)
    if purpose not in PURPOSES:
        raise InvalidRow(UNKNOWN_PURPOSE, purpose)

    camera_pixels = int_or_none(clean(row.get(CAMERA_PIXELS)))
    if camera_pixels is not None and camera_pixels < MIN_CAMERA_PIXELS:
        camera_pixels = None
    retention_days = int_or_none(clean(row.get(RETENTION_DAYS)))
    if retention_days == 0:
        retention_days = None

    return {
        "management_number": management_number,
        "address": address,
        "purpose": purpose,
        "camera_count": camera_count,
        "camera_pixels": camera_pixels,
        "retention_days": retention_days,
        "latitude": latitude.quantize(COORDINATE_SCALE, rounding=ROUND_HALF_UP),
        "longitude": longitude.quantize(COORDINATE_SCALE, rounding=ROUND_HALF_UP),
    }


def decimal_or_none(value):
    try:
        number = Decimal(value)
    except InvalidOperation:
        return None
    return number if number.is_finite() else None


def int_or_none(value):
    """0 이상의 정수 문자열만 숫자로 본다. 비어 있거나 숫자가 아니면 None이다."""
    if value is None or not value.isdigit():
        return None
    return int(value)


def decimal_places(number):
    """원본 문자열에 적힌 소수 자릿수. 37.50은 2자리다."""
    return max(0, -number.as_tuple().exponent)


def warn(line_number, reason, row):
    print("WARN skipped row={} reason={} management_number={}".format(
        line_number, reason, clean(row.get(MANAGEMENT_NUMBER))), file=sys.stderr)


def write_sql(output, cctvs, batch_size, centers=(), around_meters=None):
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as file:
        file.write("-- 원본: {}\n".format(SOURCE_NAME))
        for latitude, longitude in centers:
            file.write("-- 샘플 지역: {},{} 주변 {}m\n".format(latitude, longitude, around_meters))
        file.write("-- 적재 행 수: {}\n".format(len(cctvs)))
        file.write("SET NAMES utf8mb4;\n")
        file.write("START TRANSACTION;\n")
        file.write("DELETE FROM cctvs;\n")
        for start in range(0, len(cctvs), batch_size):
            batch = cctvs[start:start + batch_size]
            file.write("INSERT INTO cctvs ({}) VALUES\n".format(", ".join(INSERT_COLUMNS)))
            file.write(",\n".join(values(cctv) for cctv in batch))
            file.write(";\n")
        file.write("COMMIT;\n")


def values(cctv):
    return "(" + ", ".join(literal(cctv[column]) for column in INSERT_COLUMNS) + ")"


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, Decimal)):
        return str(value)
    return quote(value)


def quote(value):
    escaped = (value.replace("\\", "\\\\")
               .replace("'", "''")
               .replace("\n", "\\n")
               .replace("\r", "\\r")
               .replace("\0", "\\0"))
    return "'" + escaped + "'"


def print_summary(result, output):
    print("=== CCTV Import Summary ===")
    print("source            : " + SOURCE_NAME)
    print("total rows        : {:,}".format(result.total))
    print("generated rows    : {:,}".format(len(result.cctvs)))
    print("skipped rows      : {:,}".format(len(result.skipped)))
    for reason in SKIP_REASONS:
        print("  {:<16}: {:,}".format(reason, result.skipped_count(reason)))
    print("nulled pixels     : {:,}".format(result.nulled_pixels))
    print("nulled retention  : {:,}".format(result.nulled_retention))
    print("output            : " + str(output))


if __name__ == "__main__":
    main()
