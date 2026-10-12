import contextlib
import io
import socket
import tempfile
import unittest
import urllib.error
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


TOKEN_ISSUED = {"errCd": 0, "result": {"accessToken": "token-1", "accessTimeout": "1000000"}}
GEOCODED = {"errCd": 0, "result": {"resultdata": [{"x": "127.1091021", "y": "37.3942055"}]}}


class FakeSgis:
    """경로별로 정해 둔 응답을 차례로 돌려준다. 예외를 넣으면 던진다."""

    def __init__(self, auth=None, geocode=None):
        self.responses = {"authentication": list(auth or [TOKEN_ISSUED]), "geocodewgs84": list(geocode or [])}
        self.urls = []

    def __call__(self, url):
        self.urls.append(url)
        responses = self.responses["authentication" if "authentication" in url else "geocodewgs84"]
        response = responses.pop(0) if len(responses) > 1 else responses[0]
        if isinstance(response, Exception):
            raise response
        return response

    def count(self, path):
        return sum(1 for url in self.urls if path in url)


def http_error(code):
    return urllib.error.HTTPError("https://sgisapi.mods.go.kr", code, "error", {}, None)


def geocoder(sgis):
    return script.SgisGeocoder("key", "secret", request=sgis, clock=lambda: 0, sleep=lambda seconds: None)


class SgisGeocoderTest(unittest.TestCase):

    def setUp(self):
        self.stderr = contextlib.redirect_stderr(io.StringIO())
        self.stderr.__enter__()

    def tearDown(self):
        self.stderr.__exit__(None, None, None)

    def test_x는_경도_y는_위도로_변환한다(self):
        self.assertEqual(("37.3942055", "127.1091021"), geocoder(FakeSgis(geocode=[GEOCODED]))("주소"))

    def test_주소를_찾지_못하면_None을_반환한다(self):
        self.assertIsNone(geocoder(FakeSgis(geocode=[{"errCd": -100, "errMsg": "검색결과가 존재하지 않습니다"}]))("주소"))

    def test_토큰을_한_번_발급해_재사용한다(self):
        sgis = FakeSgis(geocode=[GEOCODED])
        geocode = geocoder(sgis)

        geocode("주소1")
        geocode("주소2")

        self.assertEqual(1, sgis.count("authentication"))
        self.assertIn("accessToken=token-1", sgis.urls[-1])

    def test_토큰_만료가_가까우면_다시_발급한다(self):
        sgis = FakeSgis(geocode=[GEOCODED])
        now = [0]
        geocode = script.SgisGeocoder("key", "secret", request=sgis, clock=lambda: now[0], sleep=lambda seconds: None)

        geocode("주소1")
        now[0] = 1000 - 60  # 만료(1000초) 1분 전
        geocode("주소2")

        self.assertEqual(2, sgis.count("authentication"))

    def test_SGIS가_토큰을_거부하면_한_번_재발급해_다시_요청한다(self):
        sgis = FakeSgis(geocode=[{"errCd": -401, "errMsg": "인증 정보가 존재하지 않습니다"}, GEOCODED])

        self.assertEqual(("37.3942055", "127.1091021"), geocoder(sgis)("주소"))
        self.assertEqual(2, sgis.count("authentication"))

    def test_토큰_발급이_실패하면_전체_작업을_실패시킨다(self):
        sgis = FakeSgis(auth=[{"errCd": -401, "errMsg": "잘못된 consumer key"}])

        with self.assertRaisesRegex(script.SgisError, "토큰 발급"):
            geocoder(sgis)("주소")

    def test_HTTP_401이면_재시도하지_않고_전체_작업을_실패시킨다(self):
        sgis = FakeSgis(auth=[http_error(401)])

        with self.assertRaisesRegex(script.SgisError, "401"):
            geocoder(sgis)("주소")
        self.assertEqual(1, sgis.count("authentication"))

    def test_5xx와_timeout은_재시도한다(self):
        sgis = FakeSgis(geocode=[http_error(503), socket.timeout("timed out"), GEOCODED])

        self.assertEqual(("37.3942055", "127.1091021"), geocoder(sgis)("주소"))
        self.assertEqual(3, sgis.count("geocodewgs84"))

    def test_SGIS_서버_오류는_재시도한다(self):
        sgis = FakeSgis(geocode=[{"errCd": -1, "errMsg": "서버에서 처리 중 에러가 발생하였습니다."}, GEOCODED])

        self.assertEqual(("37.3942055", "127.1091021"), geocoder(sgis)("주소"))
        self.assertEqual(2, sgis.count("geocodewgs84"))

    def test_재시도를_3회_하고도_실패하면_전체_작업을_실패시킨다(self):
        sgis = FakeSgis(geocode=[http_error(500)])

        with self.assertRaisesRegex(script.SgisError, "3회"):
            geocoder(sgis)("주소")
        self.assertEqual(4, sgis.count("geocodewgs84"))

    def test_알_수_없는_오류_코드는_전체_작업을_실패시킨다(self):
        sgis = FakeSgis(geocode=[{"errCd": -200, "errMsg": "필수 파라미터 없음"}])

        with self.assertRaisesRegex(script.SgisError, "-200"):
            geocoder(sgis)("주소")

    def test_SGIS_장애가_나면_적재_대상을_만들지_않는다(self):
        sgis = FakeSgis(geocode=[GEOCODED, http_error(500)])

        with self.assertRaises(script.SgisError):
            build(csv_row(), csv_row(업소명="다른식당"), geocode=geocoder(sgis))


class SgisServerErrorTokenTest(unittest.TestCase):

    def test_서버_오류가_계속되면_토큰을_새로_발급해_한_번_더_시도한다(self):
        server_error = {"errCd": -1, "errMsg": "서버에서 처리 중 에러가 발생하였습니다."}
        sgis = FakeSgis(geocode=[server_error] * 4 + [GEOCODED])

        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(("37.3942055", "127.1091021"), geocoder(sgis)("주소"))
        self.assertEqual(2, sgis.count("authentication"))

    def test_새_토큰으로도_서버_오류가_계속되면_그_주소만_제외한다(self):
        sgis = FakeSgis(geocode=[{"errCd": -1, "errMsg": "서버에서 처리 중 에러가 발생하였습니다."}])

        with contextlib.redirect_stderr(io.StringIO()):
            result = build(csv_row(), geocode=geocoder(sgis))

        self.assertEqual([], result.stores)
        self.assertEqual("sgis server error", result.geocode_failed[0][1])
        self.assertEqual(8, sgis.count("geocodewgs84"))


class CachedGeocoderTest(unittest.TestCase):

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "cache.jsonl"
        self.calls = []
        self.stderr = contextlib.redirect_stderr(io.StringIO())
        self.stderr.__enter__()

    def tearDown(self):
        self.stderr.__exit__(None, None, None)
        self.directory.cleanup()

    def geocode(self, address):
        self.calls.append(address)
        return None if address == "없는 주소" else ("37.1", "127.1")

    def test_변환_결과를_기록하고_다시_실행하면_호출하지_않는다(self):
        script.CachedGeocoder(self.geocode, self.path)("주소")
        script.CachedGeocoder(self.geocode, self.path)("없는 주소")

        resumed = script.CachedGeocoder(self.geocode, self.path)

        self.assertEqual(("37.1", "127.1"), resumed("주소"))
        self.assertIsNone(resumed("없는 주소"))
        self.assertEqual(["주소", "없는 주소"], self.calls)

    def test_서버_오류_주소는_다시_호출하지_않고_파일에도_기록하지_않는다(self):
        calls = []

        def broken(address):
            calls.append(address)
            raise script.SgisAddressError()

        cached = script.CachedGeocoder(broken, self.path)
        for _ in range(2):
            with self.assertRaises(script.SgisAddressError):
                cached("주소")

        self.assertEqual(["주소"], calls)
        self.assertFalse(self.path.exists())

    def test_장애로_실패한_주소는_기록하지_않는다(self):
        def broken(address):
            raise script.SgisError("장애")

        with self.assertRaises(script.SgisError):
            script.CachedGeocoder(broken, self.path)("주소")

        self.assertEqual(("37.1", "127.1"), script.CachedGeocoder(self.geocode, self.path)("주소"))
        self.assertEqual(["주소"], self.calls)


class GeocodeAllTest(unittest.TestCase):

    def setUp(self):
        self.stderr = contextlib.redirect_stderr(io.StringIO())
        self.stderr.__enter__()

    def tearDown(self):
        self.stderr.__exit__(None, None, None)

    def test_필수_값이_있는_행의_주소를_한_번씩만_변환한다(self):
        requested = []
        rows = list(enumerate([csv_row(), csv_row(업소명="같은주소식당"), csv_row(주소="다른 주소"), csv_row(업종="")],
                              start=2))

        script.geocode_all(rows, lambda address: requested.append(address) or found(address), workers=4)

        self.assertEqual(sorted(["경기도 성남시 분당구 판교역로 1", "다른 주소"]), sorted(requested))

    def test_서버_오류_주소가_있어도_나머지는_변환한다(self):
        def geocode(address):
            if address == "오류 주소":
                raise script.SgisAddressError()
            return found(address)

        rows = list(enumerate([csv_row(주소="오류 주소"), csv_row(주소="정상 주소")], start=2))

        script.geocode_all(rows, geocode, workers=2)

    def test_서버_오류_주소가_연달아_나오면_장애로_보고_중단한다(self):
        def broken(address):
            raise script.SgisAddressError()

        rows = list(enumerate([csv_row(주소="주소" + str(index)) for index in range(10)], start=2))

        with self.assertRaisesRegex(script.SgisError, "연달아"):
            script.geocode_all(rows, broken, workers=4)

    def test_변환_중_장애가_나면_전체_작업을_중단한다(self):
        def broken(address):
            raise script.SgisError("장애")

        rows = list(enumerate([csv_row(주소="주소" + str(index)) for index in range(10)], start=2))

        with self.assertRaises(script.SgisError):
            script.geocode_all(rows, broken, workers=4)


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


class AroundTest(unittest.TestCase):

    def test_기준_좌표_주변_사각형_안의_업소만_포함한다(self):
        bounds = script.area((Decimal("37.3948"), Decimal("127.1119")), 2500)
        inside = {"latitude": Decimal("37.4000000"), "longitude": Decimal("127.1100000")}
        outside = {"latitude": Decimal("37.5665000"), "longitude": Decimal("126.9780000")}

        self.assertTrue(script.contains(bounds, inside))
        self.assertFalse(script.contains(bounds, outside))

    def test_샘플_지역을_SQL_주석으로_남긴다(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "out.sql"
            script.write_sql(output, [], 1000, SOURCE_DATE, [(Decimal("37.3948"), Decimal("127.1119"))], 2500)
            sql = output.read_text(encoding="utf-8")

        self.assertIn("-- 샘플 지역: 37.3948,127.1119 주변 2500m", sql)


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
