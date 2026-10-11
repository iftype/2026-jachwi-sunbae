import contextlib
import io
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

import generate_good_price_stores_sql as script

HEADER = ["시도", "시군", "업종", "업소명", "연락처", "주소",
          "메뉴1", "가격1", "메뉴2", "가격2", "메뉴3", "가격3", "메뉴4", "가격4"]

SOURCE_DATE = date(2026, 6, 30)


def csv_row(**overrides):
    row = {header: "" for header in HEADER}
    row.update({
        "시도": "경기도",
        "시군": "성남시",
        "업종": "한식",
        "업소명": "좋은식당",
        "연락처": "031-123-4567",
        "주소": "경기도 성남시 분당구 판교역로 1",
        "메뉴1": "김치찌개",
        "가격1": "7000",
    })
    row.update(overrides)
    return row


def found(address):
    return 37.3942055, 127.1091021


def build(*rows, geocode=found):
    with contextlib.redirect_stderr(io.StringIO()):
        return script.build_stores(list(enumerate(rows, start=2)), geocode)


class ColumnValidationTest(unittest.TestCase):

    def test_필수_CSV_컬럼이_없으면_전체_작업을_실패시킨다(self):
        with self.assertRaisesRegex(script.InvalidCsv, "주소"):
            script.validate_columns([header for header in HEADER if header != "주소"])

    def test_CP949_CSV를_읽는다(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "stores.csv"
            path.write_text(",".join(HEADER) + "\n" + ",".join(csv_row()[header] for header in HEADER) + "\n",
                            encoding="cp949")

            rows = script.read_rows(path, "cp949")

        self.assertEqual([(2, "좋은식당")], [(line, row["업소명"]) for line, row in rows])


class CleaningTest(unittest.TestCase):

    def test_앞뒤_공백을_제거한다(self):
        store = build(csv_row(업소명="  좋은식당 ")).stores[0]

        self.assertEqual("좋은식당", store["name"])

    def test_빈_문자열과_NaN을_NULL로_바꾼다(self):
        store = build(csv_row(시군=" ", 연락처="NaN", 가격1="")).stores[0]

        self.assertIsNone(store["district"])
        self.assertIsNone(store["phone"])
        self.assertIsNone(store["menu_price_1"])

    def test_업종과_가격과_연락처는_원본_문자열을_유지한다(self):
        store = build(csv_row(업종="이용업", 가격1="일반: 10000원/ 노인: 8000원", 연락처="0317771234")).stores[0]

        self.assertEqual("이용업", store["business_type"])
        self.assertEqual("일반: 10000원/ 노인: 8000원", store["menu_price_1"])
        self.assertEqual("0317771234", store["phone"])

    def test_메뉴는_있지만_가격이_없는_행을_허용한다(self):
        store = build(csv_row(메뉴2="된장찌개", 가격2="")).stores[0]

        self.assertEqual("된장찌개", store["menu_name_2"])
        self.assertIsNone(store["menu_price_2"])


class RowValidationTest(unittest.TestCase):

    def test_필수_값이_없는_행만_제외한다(self):
        result = build(csv_row(주소=""), csv_row(업소명="다른식당"))

        self.assertEqual(["다른식당"], [store["name"] for store in result.stores])
        self.assertEqual([(2, "missing 주소")], [(line, reason) for line, reason, _ in result.invalid_rows])

    def test_컬럼_길이를_넘는_행을_제외한다(self):
        result = build(csv_row(업소명="가" * 101))

        self.assertEqual([], result.stores)
        self.assertEqual("too long 업소명", result.invalid_rows[0][1])

    def test_업소명과_주소가_중복되면_경고만_남기고_제외하지_않는다(self):
        result = build(csv_row(), csv_row())

        self.assertEqual(2, len(result.stores))
        self.assertEqual([3], [line for line, _, _ in result.duplicates])


class GeocodeResultTest(unittest.TestCase):

    def test_좌표를_찾지_못한_행만_제외한다(self):
        result = build(csv_row(주소="없는 주소"), csv_row(),
                       geocode=lambda address: None if address == "없는 주소" else found(address))

        self.assertEqual(1, len(result.stores))
        self.assertEqual([(2, "no result")], [(line, reason) for line, reason, _ in result.geocode_failed])

    def test_국내_범위_밖_좌표는_제외한다(self):
        result = build(csv_row(), geocode=lambda address: (127.1, 37.3))

        self.assertEqual("out of korea", result.geocode_failed[0][1])

    def test_좌표를_소수_7자리로_반올림한다(self):
        store = build(csv_row(), geocode=lambda address: (37.123456789, 127.123456749)).stores[0]

        self.assertEqual(Decimal("37.1234568"), store["latitude"])
        self.assertEqual(Decimal("127.1234567"), store["longitude"])

    def test_좌표_변환_중_예외는_전체_작업을_중단한다(self):
        def broken(address):
            raise RuntimeError("SGIS 인증 실패")

        with self.assertRaises(RuntimeError):
            build(csv_row(), geocode=broken)


class SqlTest(unittest.TestCase):

    def test_SQL_특수문자를_escape한다(self):
        self.assertEqual("'it''s \\\\ a\\nb'", script.quote("it's \\ a\nb"))
        self.assertEqual("NULL", script.quote(None))

    def test_일정_개수_단위로_INSERT를_나눈다(self):
        stores = build(*[csv_row(업소명="식당" + str(index)) for index in range(5)]).stores

        sql = self.write(stores, batch_size=2)

        self.assertEqual(3, sql.count("INSERT INTO good_price_stores"))
        self.assertIn("DELETE FROM good_price_stores;", sql)
        self.assertTrue(sql.rstrip().endswith("COMMIT;"))

    def test_좌표와_기준일을_포함한_행을_만든다(self):
        stores = build(csv_row(시군="")).stores

        sql = self.write(stores, batch_size=1000)

        self.assertIn("('경기도', NULL, '한식', '좋은식당', '031-123-4567', '경기도 성남시 분당구 판교역로 1', "
                      "37.3942055, 127.1091021, '김치찌개', '7000', NULL, NULL, NULL, NULL, NULL, NULL, "
                      "'2026-06-30')", sql)

    def write(self, stores, batch_size):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "out.sql"
            script.write_sql(output, stores, batch_size, SOURCE_DATE)
            return output.read_text(encoding="utf-8")


class SummaryTest(unittest.TestCase):

    def test_실행_결과_summary를_출력한다(self):
        result = build(csv_row(), csv_row(주소=""), csv_row(업소명="없는곳", 주소="없는 주소"),
                       geocode=lambda address: None if address == "없는 주소" else found(address))
        output = io.StringIO()

        with contextlib.redirect_stdout(output):
            script.print_summary(result, SOURCE_DATE, Path("/tmp/good-price-stores.sql"))

        summary = output.getvalue()
        self.assertIn("total rows       : 3", summary)
        self.assertIn("generated rows   : 1", summary)
        self.assertIn("skipped rows     : 2", summary)
        self.assertIn("invalid rows     : 1", summary)
        self.assertIn("geocode failed   : 1", summary)
        self.assertIn("duplicates found : 0", summary)


if __name__ == "__main__":
    unittest.main()
