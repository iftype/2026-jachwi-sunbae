#!/usr/bin/env python3
"""국토교통부 전국 버스정류장 위치정보 CSV를 정제해 bus_stops 적재 SQL을 만든다.

해당 스크립트는 개발자 PC에서 한번 실행하는 도구이다.
하지만 남겨놓는 이유는 정제 규칙 자체가 데이터 정책이기 때문이다.(개인 로컬에만 있으면 정합성이 깨질, 즉 버그 발생 확률이 올라간다.)

사용법:
    python3 generate_bus_stops_sql.py <CSV 경로> --output <SQL 경로>

로컬 개발용 샘플 (기준 좌표 주변만):
    python3 generate_bus_stops_sql.py <CSV 경로> --output <SQL 경로> \
        --around 37.3948,127.1119 --around 37.5665,126.978 --around-meters 2500

생성한 SQL은 한 트랜잭션 안에서 bus_stops를 비우고 다시 채운다.
적재 중 오류가 나면 전체가 롤백되고, 원본에서 사라진(폐지된) 정류장도 함께 정리된다.
전체 SQL은 약 20MB라 저장소에 커밋하지 않는다.
"""

import argparse
import csv
import math
import sys
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

# 국내 좌표 범위. 위경도가 뒤바뀌었거나 한쪽 값이 잘못 들어간 행을 걸러낸다.
KOREA_LATITUDE = (Decimal("33"), Decimal("39"))
KOREA_LONGITUDE = (Decimal("124"), Decimal("132"))

# bus_stops 컬럼 길이와 맞춘다.
MAX_NODE_ID_LENGTH = 20
MAX_NAME_LENGTH = 50
MAX_CITY_CODE_LENGTH = 5
MAX_CITY_NAME_LENGTH = 30

# DECIMAL(10, 7), DECIMAL(11, 7)에 맞춰 소수 7자리로 반올림한다.
COORDINATE_SCALE = Decimal("0.0000001")

# 위도 1도의 거리(m). 샘플 지역의 위경도 범위를 계산할 때 쓴다.
METERS_PER_LATITUDE_DEGREE = 111_320

COLUMNS = {
    "node_id": "정류장번호",
    "name": "정류장명",
    "latitude": "위도",
    "longitude": "경도",
    "city_code": "도시코드",
    "city_name": "도시명",
}


class InvalidRow(Exception):
    pass


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


def contains(bounds, stop):
    min_latitude, max_latitude, min_longitude, max_longitude = bounds
    return (min_latitude <= stop["latitude"] <= max_latitude
            and min_longitude <= stop["longitude"] <= max_longitude)


def main():
    parser = argparse.ArgumentParser(description="버스정류장 CSV로 bus_stops 적재 SQL을 만든다.")
    parser.add_argument("csv_path", type=Path, help="국토교통부 전국 버스정류장 위치정보 CSV")
    parser.add_argument("--output", type=Path, required=True, help="생성할 SQL 파일 경로")
    parser.add_argument("--encoding", default="euc-kr", help="CSV 인코딩 (기본: euc-kr)")
    parser.add_argument("--batch-size", type=int, default=1000, help="INSERT 한 문장에 넣을 행 수")
    parser.add_argument("--around", type=coordinate_pair, action="append", default=[],
                        metavar="위도,경도", help="이 좌표 주변 정류장만 넣는다. 여러 번 쓸 수 있다")
    parser.add_argument("--around-meters", type=int, default=2500,
                        help="--around 기준 좌표에서 위아래·좌우로 포함할 거리(m)")
    args = parser.parse_args()

    stops, skipped, total = read_stops(args.csv_path, args.encoding)
    if args.around:
        areas = [area(center, args.around_meters) for center in args.around]
        stops = [stop for stop in stops if any(contains(bounds, stop) for bounds in areas)]
    write_sql(args.output, stops, args.batch_size, args.csv_path.name, args.around, args.around_meters)
    print_summary(total, stops, skipped, args.output)


def read_stops(csv_path, encoding):
    stops = []
    skipped = []
    node_ids = set()
    total = 0
    with csv_path.open(encoding=encoding, newline="") as file:
        reader = csv.DictReader(file)
        missing = [header for header in COLUMNS.values() if header not in (reader.fieldnames or [])]
        if missing:
            sys.exit("CSV에 필요한 컬럼이 없습니다: " + ", ".join(missing))

        for line_number, row in enumerate(reader, start=2):
            total += 1
            try:
                stop = parse_stop(row)
                if stop["node_id"] in node_ids:
                    raise InvalidRow("중복 정류장번호")
            except InvalidRow as exception:
                skipped.append((line_number, str(exception), row))
                continue
            node_ids.add(stop["node_id"])
            stops.append(stop)
    return stops, skipped, total


def parse_stop(row):
    node_id = required_text(row, "node_id", MAX_NODE_ID_LENGTH)
    name = required_text(row, "name", MAX_NAME_LENGTH)
    city_code = required_text(row, "city_code", MAX_CITY_CODE_LENGTH)
    if not city_code.isdigit():
        raise InvalidRow("도시코드 형식 오류")
    city_name = required_text(row, "city_name", MAX_CITY_NAME_LENGTH)
    latitude = coordinate(row, "latitude", KOREA_LATITUDE)
    longitude = coordinate(row, "longitude", KOREA_LONGITUDE)
    return {
        "node_id": node_id,
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "city_code": city_code,
        "city_name": city_name,
    }


def required_text(row, column, max_length):
    value = (row.get(COLUMNS[column]) or "").strip()
    if not value:
        raise InvalidRow(COLUMNS[column] + " 없음")
    if len(value) > max_length:
        raise InvalidRow(COLUMNS[column] + " 길이 초과")
    return value


def coordinate(row, column, valid_range):
    value = (row.get(COLUMNS[column]) or "").strip()
    if not value:
        raise InvalidRow("좌표 없음")
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise InvalidRow("좌표 형식 오류")
    if not valid_range[0] <= number <= valid_range[1]:
        raise InvalidRow("국내 범위 밖 좌표")
    return number.quantize(COORDINATE_SCALE, rounding=ROUND_HALF_UP)


def write_sql(output, stops, batch_size, source_name, centers, around_meters):
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as file:
        file.write("-- 원본: " + source_name + "\n")
        for latitude, longitude in centers:
            file.write("-- 샘플 지역: {},{} 주변 {}m\n".format(latitude, longitude, around_meters))
        file.write("-- 적재 행 수: " + str(len(stops)) + "\n")
        file.write("SET NAMES utf8mb4;\n")
        file.write("START TRANSACTION;\n")
        file.write("DELETE FROM bus_stops;\n")
        for start in range(0, len(stops), batch_size):
            batch = stops[start:start + batch_size]
            file.write("INSERT INTO bus_stops (node_id, name, latitude, longitude, city_code, city_name) VALUES\n")
            file.write(",\n".join(values(stop) for stop in batch))
            file.write(";\n")
        file.write("COMMIT;\n")


def values(stop):
    return "({}, {}, {}, {}, {}, {})".format(
        quote(stop["node_id"]),
        quote(stop["name"]),
        stop["latitude"],
        stop["longitude"],
        quote(stop["city_code"]),
        quote(stop["city_name"]),
    )


def quote(value):
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def print_summary(total, stops, skipped, output):
    print("전체 행: {:,}".format(total))
    print("적재 행: {:,}".format(len(stops)))
    print("제외 행: {:,}".format(len(skipped)))
    for reason, count in Counter(reason for _, reason, _ in skipped).most_common():
        print("  - {}: {:,}".format(reason, count))
    for line_number, reason, row in skipped:
        print("  {}행 [{}] {} {} ({}, {})".format(
            line_number, reason, row.get(COLUMNS["node_id"]), row.get(COLUMNS["name"]),
            row.get(COLUMNS["latitude"]), row.get(COLUMNS["longitude"])), file=sys.stderr)
    print("생성한 SQL: " + str(output))


if __name__ == "__main__":
    main()
