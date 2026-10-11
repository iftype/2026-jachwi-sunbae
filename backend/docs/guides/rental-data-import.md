# 소형 주택 월세 실거래 CSV 적재

추천 지역에 표시할 월세 참고 사례를 공식 법정동 코드로 매핑해 별도 테이블에 적재한다. 사용자 매물인 `properties`와 분리하며, 기본 명령은 DB를 변경하지 않는 검증 모드다. 적재한 거래는 인증된 사용자가 법정동별 조회 API로 확인할 수 있다.

## 입력 자료

1. 국토부 [자료제공](https://rt.molit.go.kr/pt/xls/xls.do)에서 수집한 정제 CSV `small_home_monthly_rent.csv`.
2. 행정표준코드관리시스템 [법정동 코드 전체자료](https://www.code.go.kr/stdcode/regCodeL.do)의 ZIP 또는 압축을 푼 TXT. 한글 파일명·본문의 MS949 인코딩을 지원한다.

실거래 전체 파일은 저장소에 커밋하지 않는다. 실행자는 대상 지역과 기간을 선별한 정제 CSV, 공식 코드 자료와 수집 보고서를 준비한다. 아래 명령의 파일 경로·기간·수집 시각·예상 건수는 준비한 자료에 맞게 지정한다.

CSV는 UTF-8이며 BOM을 허용한다. 필수 열은 `legal_dong`, `housing_type`, `deposit_10k_krw`, `monthly_rent_10k_krw`, `area_m2`, `area_basis`, `contract_date`, `contract_type`, `building_name`, `floor`, `contract_period`, `source_file`, `source_row_number`다. 보조 열은 있어도 된다.

- `legal_dong`: 시도·시군구·읍면동·리 전체 이름. 현재 존재하는 공식 이름에 공백만 정규화하여 정확히 매핑한다. 폐지 코드나 동 이름만으로 추측하지 않는다.
- `housing_type`: `연립다세대`, `단독다가구`, `오피스텔`.
- `area_basis`: 단독·다가구 `contract`, 나머지는 `exclusive`. 계약면적을 전용면적으로 취급하지 않는다.
- 금액: CSV의 **만원**을 DB의 **원**으로 정확하게 변환한다. 보증금 0 이상, 월세 0 초과여야 한다. 소수 금액도 원 단위로 정확히 변환할 수 있을 때만 허용한다.
- 면적: 소수 넷째 자리까지 보존하며 `area_m2 × 121`이 2000~4000 범위인지 검사한다. 표시용 반올림 평수는 사용하지 않는다.
- 계약 구분: 신규 → `NEW`, 갱신 → `RENEWAL`, `-` 또는 빈 값 → `UNKNOWN`.
- 같은 날짜·가격의 여러 거래는 보존한다. 동일 `source_file`·`source_row_number`의 중복 행은 잘못된 입력으로 거부한다.

## 검증 실행

`backend`에서 실행한다. 따옴표는 Gradle의 인자 분리에서도 공백이 있는 경로를 보존하기 위해 사용한다.

```bash
./gradlew importRentalTransactions --args='--transactions="/path/to/rent-data/small_home_monthly_rent.csv" --legal-dong-codes="/path/to/rent-data/legal-dong-codes.zip" --from=2026-04-09 --to=2026-10-09 --collected-at=2026-10-09T21:37:25+09:00 --expected-rows=86079 --report-dir="/path/to/rent-data/report"'
```

`--expected-rows`는 수집 보고서에서 확인한 전체 정제 건수다. 실제 건수와 비교하며, 전체 대상 지역을 포함했는지는 실행자가 확인해야 한다. `--from`, `--to`는 양 끝 포함이고 최대 6개월이다. 모든 계약일이 그 범위 안에 있어야 한다. `--collected-at`은 원본 다운로드 시각을 시간대가 있는 ISO 8601 값으로 전달하며 DB에는 UTC로 저장한다. 여러 원본을 합칠 때는 가장 늦은 원본 다운로드 시각을 사용한다.

결과 폴더에 `import-report.json`과 `unmatched-legal-dongs.csv`가 생성된다. 보고서는 입력·매핑 건수, 법정동 수, 원본 SHA-256과 수집 기간을 포함한다. 법정동 미매핑이 하나라도 있으면 `UNMATCHED` 보고서를 작성하고 명령이 실패하며 DB에 적재하지 않는다. 다른 CSV 오류도 적재 전에 실패한다.

## DB 적재

검증 명령에 `--apply`를 추가한다. DB 연결에는 기존 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 환경변수를 사용한다. 기본은 로컬 `127.0.0.1:3306/jachwi_sunbae`다. 이 명령은 `.env`를 자동으로 로드하지 않으므로 필요하면 [로컬 개발 가이드](local-development.md)대로 환경변수를 주입한다.

적재할 DB에서 `003-rental-schema.sql`의 추가 테이블만 `CREATE TABLE IF NOT EXISTS`로 준비한다. 기존 회원·매물 테이블이나 데이터를 수정하지 않는다. 빈 Docker MySQL은 초기화 디렉터리의 이 SQL을 함께 실행한다.

| 테이블                | 책임                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `legal_dongs`         | 이번 자료에 사용한 법정동 코드와 공식 전체 이름                  |
| `rental_datasets`     | 수집 범위 키, 파일·코드 SHA-256, 수집 기간·시각, 적재 시각, 건수 |
| `rental_transactions` | 거래 금액·면적·계약일·유형·신규/갱신·원본 행 추적 정보           |

현재 수집 범위 키는 `seoul-eastern-gyeonggi`로 고정한다. 서울 25구와 경기 의정부·양주·동두천·포천·연천·구리·남양주·가평·양평·하남·광주·여주·성남·용인·이천의 **전체 정제 파일**을 입력한다. 다른 범위의 일부 파일이나 전용면적 파일만으로 이 키를 교체하지 않는다.

같은 파일·코드 자료·기간·수집 시점이면 실제 DB 건수를 확인하고 `UNCHANGED`로 종료한다. 갱신본은 수집 범위 키의 기존 거래를 삭제하고 새 거래를 넣는 과정을 하나의 트랜잭션으로 실행한다. 중간 실패는 기존 거래와 메타데이터를 모두 복구한다. 수집 범위 행을 잠가 동시 적재를 직렬화하고, 이전 수집 시점의 자료가 최신 자료를 덮어쓰는 것은 거부한다.

## 법정동별 조회 확인

신림동 예시이며 DB 금액 단위는 원이다.

```sql
SELECT d.code, d.name, t.deposit_amount_krw, t.monthly_rent_amount_krw,
       t.area_m2, t.area_basis, t.housing_type, t.contract_date, t.contract_type
FROM rental_transactions t
JOIN legal_dongs d ON d.code = t.legal_dong_code
WHERE t.legal_dong_code = '1162010200'
  AND t.contract_date BETWEEN '2026-04-09' AND '2026-10-09'
ORDER BY t.contract_date DESC, t.id DESC
LIMIT 20;
```

법정동 코드·계약일·ID 인덱스로 조회한다. 원룸 여부는 확인할 수 없어 표시명은 ‘소형 주택 월세 참고 정보’로 사용해야 한다.

## 조회 API 사용

서버를 실행하고 닉네임 로그인으로 받은 접근 토큰을 사용한다. 신림동의 첫 페이지 조회 예시다.

```bash
curl 'http://localhost:8080/api/rental-transactions?legalDongCode=1162010200&page=0&size=20' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

자세한 요청·응답 명세와 오류 코드는 서버의 `/swagger-ui/index.html`에서 확인한다. 주택 유형·면적·보증금 조건은 받지 않는다. 이미 적재 단계에서 5~10평의 월세 거래를 선별한다.

- 조회 기간은 요청 시점의 한국 날짜부터 6개월 전까지 양 끝을 포함한다. 계약일이 최근인 순서이며 같은 날짜는 거래 ID 내림차순이다. `hasNext`가 참이면 다음 페이지를 요청한다.
- `queryStartDate`·`queryEndDate`는 조회 기간, `datasetPeriodStart`·`datasetPeriodEnd`는 수집본에 포함하도록 지정한 계약일 범위다. 수집본의 기간은 실제 거래의 최소·최대 계약일이나 파일 다운로드 기간을 뜻하지 않는다. 정기 갱신 전에는 최신 날짜의 거래가 없을 수 있으므로 수집 시점도 함께 표시한다. 수집 시점은 UTC의 ISO 8601 문자열이다.
- 보증금과 월세는 원, 면적은 ㎡다. `EXCLUSIVE`는 전용면적, `CONTRACT`는 계약면적이므로 화면에서도 구분한다. 관리비와 현재 매물 여부는 이 자료로 확인할 수 없다.
- 법정동 전체 이름을 함께 안내한다. 수집된 거래가 없으면 성공 응답의 목록이 비어 있으며, 이름도 수집하지 못한 코드라면 이름이 `null`이다. 최초 적재 전에는 수집 정보도 `null`이다.
- 자료 전체 교체 시 거래 ID가 바뀔 수 있다. 화면은 페이지를 처음부터 다시 불러온다. 개별 응답의 건수·목록·수집 정보는 동일한 DB 트랜잭션에서 읽는다.

추천 화면에서는 추천 지역을 법정동 코드로 연결한 뒤 이 API를 호출한다. 행정동과 법정동은 다르므로 추천 지역 이름만으로 코드를 추측하지 않는다.

## 거래 도메인 구조

`RentalTransaction`은 아래 불변 값 객체를 조합한다. 값 객체는 생성할 때 자신이 담당하는 규칙을 검증하고, 거래 도메인은 주택 유형과 면적 기준의 조합·건물 관련 문자열 길이를 검증한다. 주택 유형·면적 기준·계약 구분은 각각 독립 enum 파일을 사용한다. `RentalCsvReader`는 각 enum의 `fromSourceValue()`로 원본 문자열을 변환하며, 대응하는 원본 값은 enum 상수에서 관리한다. 계약 구분은 `ContractType` enum의 `NEW`·`RENEWAL`·`UNKNOWN` 중 하나로 받으며 필수값이다. DB에는 원본 문자열이 아닌 enum 이름을 저장하고, JDBC 복원과 응답 변환도 같은 enum 타입을 사용한다.

| 값 객체        | 구성과 검증 책임                              |
| -------------- | --------------------------------------------- |
| `LegalDong`    | 법정동 코드·전체 이름의 형식과 이름 길이      |
| `RentalPrice`  | 원 단위 보증금·월세의 허용 범위               |
| `RentalArea`   | 면적·면적 기준, 소수 정밀도와 5~10평 범위     |
| `RentalSource` | 원본 파일·행 번호, 파일명 길이와 양수 행 번호 |

CSV 읽기와 JDBC 조회는 값 객체를 만들어 거래를 구성한다. JDBC 저장과 응답 변환에서는 값을 꺼내 기존 DB 컬럼과 응답 필드로 변환한다. 값 객체를 도입해도 CSV 입력 형식·DB 스키마·조회 응답 구조는 같다.
