import contextlib
import io
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

import generate_cctvs_sql as script

HEADER = ["개방자치단체코드", "관리번호", "관리기관명", "소재지도로명주소", "소재지지번주소", "설치목적구분",
          "카메라대수", "카메라화소수", "촬영방면정보", "보관일수", "설치연월", "관리기관전화번호",
          "WGS84위도", "WGS84경도", "데이터기준일자", "데이터갱신구분", "데이터갱신시점", "최종수정시점"]


def csv_row(**overrides):
    row = {header: "" for header in HEADER}
    row.update({
        "관리번호": "202630000000800991",
        "소재지도로명주소": "경기도 성남시 분당구 판교역로 166",
        "소재지지번주소": "경기도 성남시 분당구 백현동 532",
        "설치목적구분": "생활방범",
        "카메라대수": "2",
        "카메라화소수": "200",
        "보관일수": "30",
        "WGS84위도": "37.3951234",
        "WGS84경도": "127.1121234",
    })
    row.update(overrides)
    return row


def rows_with_numbers(*rows):
    return [dict(row, 관리번호=str(index)) for index, row in enumerate(rows)]


def build(*rows):
    with contextlib.redirect_stderr(io.StringIO()):
        return script.build_cctvs(list(enumerate(rows, start=2)))


def skipped_reasons(result):
    return [(line, reason) for line, reason, _ in result.skipped]


class ColumnValidationTest(unittest.TestCase):

    def test_필요한_CSV_컬럼이_없으면_전체_작업을_실패시킨다(self):
        with self.assertRaisesRegex(script.InvalidCsv, "보관일수"):
            script.validate_columns([header for header in HEADER if header != "보관일수"])

    def test_CP949_CSV를_읽는다(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cctvs.csv"
            path.write_text(",".join(HEADER) + "\n" + ",".join(csv_row()[header] for header in HEADER) + "\n",
                            encoding="cp949")

            rows = script.read_rows(path, "cp949")

        self.assertEqual([(2, "202630000000800991")], [(line, row["관리번호"]) for line, row in rows])


class CleaningTest(unittest.TestCase):

    def test_원본_값을_적재할_컬럼으로_옮긴다(self):
        cctv = build(csv_row()).cctvs[0]

        self.assertEqual({
            "management_number": "202630000000800991",
            "address": "경기도 성남시 분당구 판교역로 166",
            "purpose": "생활방범",
            "camera_count": 2,
            "camera_pixels": 200,
            "retention_days": 30,
            "latitude": Decimal("37.3951234"),
            "longitude": Decimal("127.1121234"),
        }, cctv)

    def test_앞뒤_공백을_제거한다(self):
        cctv = build(csv_row(관리번호=" 123 ", 설치목적구분=" 어린이보호 ")).cctvs[0]

        self.assertEqual("123", cctv["management_number"])
        self.assertEqual("어린이보호", cctv["purpose"])

    def test_도로명주소가_없으면_지번주소를_쓴다(self):
        cctv = build(csv_row(소재지도로명주소=" ")).cctvs[0]

        self.assertEqual("경기도 성남시 분당구 백현동 532", cctv["address"])

    def test_좌표를_소수_7자리로_반올림한다(self):
        cctv = build(csv_row(WGS84위도="37.12345678901", WGS84경도="127.12345675")).cctvs[0]

        self.assertEqual(Decimal("37.1234568"), cctv["latitude"])
        self.assertEqual(Decimal("127.1234568"), cctv["longitude"])


class NullConversionTest(unittest.TestCase):

    def test_화소수가_비어_있거나_숫자가_아니거나_100_미만이면_NULL로_바꾼다(self):
        result = build(*rows_with_numbers(
            csv_row(카메라화소수=""), csv_row(카메라화소수="NaN"), csv_row(카메라화소수="2백만"),
            csv_row(카메라화소수="41"), csv_row(카메라화소수="100")))

        self.assertEqual([None, None, None, None, 100], [cctv["camera_pixels"] for cctv in result.cctvs])
        self.assertEqual(4, result.nulled_pixels)

    def test_보관일수가_비어_있거나_숫자가_아니거나_0이면_NULL로_바꾼다(self):
        result = build(*rows_with_numbers(
            csv_row(보관일수=""), csv_row(보관일수="한달"), csv_row(보관일수="0"), csv_row(보관일수="7")))

        self.assertEqual([None, None, None, 7], [cctv["retention_days"] for cctv in result.cctvs])
        self.assertEqual(3, result.nulled_retention)

    def test_값만_NULL로_바꾸고_행은_유지한다(self):
        result = build(csv_row(카메라화소수="", 보관일수=""))

        self.assertEqual(1, len(result.cctvs))
        self.assertEqual([], result.skipped)


class SkipRuleTest(unittest.TestCase):

    def assertSkipped(self, reason, **overrides):
        result = build(csv_row(**overrides))

        self.assertEqual([], result.cctvs)
        self.assertEqual([(2, reason)], skipped_reasons(result))

    def test_필수_값이_없는_행을_제외한다(self):
        for header in ["관리번호", "설치목적구분", "카메라대수", "WGS84위도", "WGS84경도"]:
            with self.subTest(header=header):
                self.assertSkipped(script.MISSING_VALUE, **{header: ""})

    def test_도로명과_지번주소가_모두_없으면_제외한다(self):
        self.assertSkipped(script.MISSING_VALUE, 소재지도로명주소="", 소재지지번주소="")

    def test_컬럼_길이를_넘는_행을_제외한다(self):
        self.assertSkipped(script.TOO_LONG, 관리번호="1" * 31)

    def test_위도_경도_카메라대수가_숫자가_아니면_제외한다(self):
        for overrides in [{"WGS84위도": "북위37"}, {"WGS84경도": "NaN경도"}, {"카메라대수": "두대"},
                          {"카메라대수": "-1"}, {"WGS84위도": "Infinity"}]:
            with self.subTest(overrides=overrides):
                self.assertSkipped(script.INVALID_NUMBER, **overrides)

    def test_국내_범위_밖_좌표를_제외하고_뒤집힌_위경도를_고치지_않는다(self):
        for latitude, longitude in [("25.1135", "129.03206"), ("37.598561", "216.994723"),
                                    ("127.1121234", "37.3951234")]:
            with self.subTest(latitude=latitude, longitude=longitude):
                self.assertSkipped(script.OUT_OF_KOREA, WGS84위도=latitude, WGS84경도=longitude)

    def test_국내_범위_경계값은_허용한다(self):
        result = build(csv_row(WGS84위도="33.000", WGS84경도="132.000"))

        self.assertEqual(1, len(result.cctvs))

    def test_일괄_입력된_가짜_좌표를_제외한다(self):
        for latitude, longitude in [("36.00000", "127.00000"), ("36.1", "127.1"), ("36.000100", "128.000100")]:
            with self.subTest(latitude=latitude, longitude=longitude):
                self.assertSkipped(script.FAKE_COORDINATE, WGS84위도=latitude, WGS84경도=longitude)

    def test_위도나_경도가_소수_2자리_이하면_제외한다(self):
        for latitude, longitude in [("37.57", "127.0118"), ("37.5781", "127.01"), ("37", "127.0118")]:
            with self.subTest(latitude=latitude, longitude=longitude):
                self.assertSkipped(script.LOW_PRECISION, WGS84위도=latitude, WGS84경도=longitude)

    def test_위도와_경도가_소수_3자리면_허용한다(self):
        result = build(csv_row(WGS84위도="37.578", WGS84경도="127.020"))

        self.assertEqual(1, len(result.cctvs))

    def test_카메라대수가_0이면_제외한다(self):
        self.assertSkipped(script.ZERO_CAMERA, 카메라대수="0")

    def test_알_수_없는_설치목적은_제외한다(self):
        self.assertSkipped(script.UNKNOWN_PURPOSE, 설치목적구분="방범")

    def test_설치목적_10가지를_모두_허용한다(self):
        result = build(*rows_with_numbers(*(csv_row(설치목적구분=purpose) for purpose in sorted(script.PURPOSES))))

        self.assertEqual(10, len(result.cctvs))

    def test_여러_규칙에_걸리면_처음_걸린_이유_하나로만_센다(self):
        self.assertSkipped(script.OUT_OF_KOREA, WGS84위도="25.1", 카메라대수="0", 설치목적구분="방범")

    def test_문제가_있는_행만_제외하고_계속한다(self):
        result = build(*rows_with_numbers(csv_row(카메라대수="0"), csv_row()))

        self.assertEqual(["1"], [cctv["management_number"] for cctv in result.cctvs])
        self.assertEqual([(2, script.ZERO_CAMERA)], skipped_reasons(result))


class DuplicateTest(unittest.TestCase):

    def test_적재할_행의_관리번호가_중복되면_전체_작업을_실패시킨다(self):
        with self.assertRaisesRegex(script.InvalidCsv, "row=2, row=3"):
            build(csv_row(), csv_row())

    def test_제외된_행과_관리번호가_같은_것은_중복으로_보지_않는다(self):
        result = build(csv_row(카메라대수="0"), csv_row())

        self.assertEqual(1, len(result.cctvs))


class SqlTest(unittest.TestCase):

    def write(self, cctvs, batch_size=1000):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "cctvs.sql"
            script.write_sql(output, cctvs, batch_size)
            return output.read_text(encoding="utf-8")

    def test_한_트랜잭션_안에서_비우고_다시_채운다(self):
        sql = self.write(build(csv_row()).cctvs)

        self.assertIn("START TRANSACTION;\nDELETE FROM cctvs;\nINSERT INTO cctvs (management_number, address, "
                      "purpose, camera_count, camera_pixels, retention_days, latitude, longitude) VALUES\n", sql)
        self.assertTrue(sql.endswith("COMMIT;\n"))

    def test_숫자는_그대로_쓰고_NULL은_NULL로_쓴다(self):
        sql = self.write(build(csv_row(카메라화소수="", 보관일수="")).cctvs)

        self.assertIn("('202630000000800991', '경기도 성남시 분당구 판교역로 166', '생활방범', 2, NULL, NULL, "
                      "37.3951234, 127.1121234);", sql)

    def test_특수문자를_escape한다(self):
        self.assertEqual(r"'a''b\\c\nd'", script.quote("a'b\\c\nd"))

    def test_정해진_행_수마다_INSERT를_나눈다(self):
        cctvs = build(*rows_with_numbers(*(csv_row() for _ in range(5)))).cctvs

        sql = self.write(cctvs, batch_size=2)

        self.assertEqual(3, sql.count("INSERT INTO cctvs"))
        self.assertIn("-- 적재 행 수: 5\n", sql)


class SampleAreaTest(unittest.TestCase):

    def test_기준_좌표_주변_CCTV만_샘플에_포함한다(self):
        bounds = script.area((Decimal("37.3948"), Decimal("127.1119")), 2500)
        near = build(csv_row()).cctvs[0]
        far = build(csv_row(WGS84위도="37.5665123", WGS84경도="126.9780123")).cctvs[0]

        self.assertTrue(script.contains(bounds, near))
        self.assertFalse(script.contains(bounds, far))


class SummaryTest(unittest.TestCase):

    def test_제외_이유별_건수와_NULL_변환_건수를_출력한다(self):
        result = build(*rows_with_numbers(csv_row(카메라대수="0"), csv_row(WGS84위도="36.1", WGS84경도="127.1"),
                                          csv_row(카메라화소수="")))
        output = io.StringIO()

        with contextlib.redirect_stdout(output):
            script.print_summary(result, Path("/tmp/cctvs.sql"))

        summary = output.getvalue()
        self.assertIn("total rows        : 3\n", summary)
        self.assertIn("generated rows    : 1\n", summary)
        self.assertIn("skipped rows      : 2\n", summary)
        self.assertIn("  fake coordinate : 1\n", summary)
        self.assertIn("  zero camera     : 1\n", summary)
        self.assertIn("  low precision   : 0\n", summary)
        self.assertIn("nulled pixels     : 1\n", summary)


if __name__ == "__main__":
    unittest.main()
