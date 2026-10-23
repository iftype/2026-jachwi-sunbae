# 10개 기상 요소의 RAW 파싱 계약

`nph-dfs_shrt_grd`의 숫자 RAW를 대상으로 한다. 확인일은 2026-10-23이며, 공통 구조와 오류 처리는 [전국 날씨 데이터 수집](weather-collection.md#raw-파싱-규칙)을 따른다.

## 요소별 의미와 확인 범위

아래 단위·코드는 [기상기후데이터위키의 요소 설명](https://datawiki.kma.go.kr/doku.php?id=%EA%B8%B0%EC%83%81%EC%98%88%EB%B3%B4:%EB%82%A0%EC%94%A8%EC%98%88%EB%B3%B4:%EB%8B%A8%EA%B8%B0%EC%98%88%EB%B3%B4)을 참고했다. 공식 설명과 특정 RAW에서 관측한 값은 구분한다.

| 요소 | 의미·단위                                       | 이번 RAW에서 확인한 내용                            |
| ---- | ----------------------------------------------- | --------------------------------------------------- |
| TMP  | 1시간 기온, ℃                                   | 음수·0·양수 보존                                    |
| SKY  | 하늘상태: 1 맑음, 3 구름많음, 4 흐림            | 세 코드 모두 존재. 0은 공식 코드에 없음             |
| PTY  | 강수형태: 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기 | 실제 샘플은 0만 존재. 1~4는 공식 코드로 합성 테스트 |
| POP  | 일반 요소 설명은 강수확률, %                    | 0·20·30 존재. Boolean으로 변환하지 않음             |
| PCP  | 1시간 강수량, 범주(mm)                          | 0만 존재. 비0 숫자와 실제 강수량의 대응 미확인      |
| SNO  | 1시간 신적설, 범주(cm)                          | 0만 존재. 비0 숫자와 실제 적설량의 대응 미확인      |
| REH  | 상대습도, %                                     | 40~100의 숫자 보존                                  |
| WSD  | 풍속, m/s                                       | 0·0.1·0.7 등 소수 보존. 임의 배율을 곱하지 않음     |
| TMN  | 일 최저기온, ℃                                  | 음수·0·양수와 다음 날 요청 시각 보존                |
| TMX  | 일 최고기온, ℃                                  | 양수와 다음 날 요청 시각 보존                       |

POP는 [격자 API의 변수 목록](https://apihub.kma.go.kr/apiList.do?seqApi=10&seqApiSub=286)에서 `강수유무`로 표기되어 일반 요소 설명과 다르다. 이번 샘플은 확률 해석과 부합하지만, 수치 분포만으로 해당 엔드포인트의 의미를 확정하지 않는다. 확률값으로 서비스에 노출하기 전 동일 발표·대상시각·격자의 공식 확률 자료와 대조하거나 제공기관에 확인해야 한다.

PCP·SNO의 비0 값은 추가 강수·적설 샘플과 이 엔드포인트의 범주 대응 근거가 필요하다. 다른 API의 문자열 표현이나 범주표를 그대로 적용하지 않는다. 지금은 숫자를 보존하며 mm·cm 환산, 범주 라벨 변환과 강수량 기반 판단은 하지 않는다.

위키의 요소 표에 있는 압축자료의 Missing·비트 수를 숫자 RAW에 적용하지 않는다. 현재 RAW에서는 `-99`·`-999`를 제외하며, 0과 음수 기온을 결측으로 취급하지 않는다. 파싱 성공은 구조가 유효하고 숫자가 유한하다는 뜻이다. SKY·PTY의 허용 코드나 요소별 물리 범위를 검사했다는 뜻은 아니다.

## 발표시각과 예보대상시각

[API허브의 현재 안내](https://apihub.kma.go.kr/apiList.do?seqApi=10&seqApiSub=286)를 기준으로 `tmfc`·`tmef`는 KST `yyyyMMddHH`다. 발표는 매일 02·05·08·11·14·17·20·23시이며, 시간별 요소는 1시간 간격으로 제공한다. 2024-11-28 14시 이후 안내의 예보기간은 02~~14시 발표가 글피 자정까지, 17~~23시 발표가 그글피 자정까지다. 위키에 남아 있는 확대 전 예보기간을 수집 계획의 기준으로 쓰지 않는다.

| 구분      | 대상                            | 이번에 성공 응답을 확인한 `tmfc` → `tmef` |
| --------- | ------------------------------- | ----------------------------------------- |
| 시간별    | TMP·SKY·PTY·POP·PCP·SNO·REH·WSD | `2026102217` → `2026102220`               |
| 일별 최저 | TMN                             | `2026102217` → `2026102306`               |
| 일별 최고 | TMX                             | `2026102217` → `2026102315`               |

TMN 06시·TMX 15시는 이 샘플에서 확인한 요청 시각이다. 모든 발표분의 제공 범위나 그 밖의 시각에 대한 미제공까지 검증한 것은 아니다. 일별 기온을 해당 시각의 TMP로 대체하거나 시간별 24회 수집 대상으로 취급하지 않는다. 발표분별 당일·익일 제공 여부와 공개 지연은 수집 계획 작업에서 추가 검증한다.

RAW 본문에는 요소·시각이 없으므로 파서는 전달받은 메타데이터를 그대로 보관한다. TMN·TMX의 시각 제한과 발표분 선택은 파서가 아닌 수집 계획의 책임이다.

## 실제 샘플의 대조 기준

로컬 실험에 저장한 `2026102217_<tmef>_<요소>.raw` 10개를 사용했다. 파일명은 위 표의 `tmef`를 따른다. 모두 341,297바이트, 물리적 2,024줄, 숫자 37,697개다. 물리적 줄 수는 격자 높이 253과 다르다.

| 요소 | 유효 / 결측    | 관측한 결측 표기 | 유효 숫자 범위 | `(60, 127)` |
| ---- | -------------- | ---------------- | -------------- | ----------- |
| TMP  | 9,295 / 28,402 | -99              | -7~20          | 10          |
| SKY  | 30,364 / 7,333 | -999             | 1·3·4          | 1           |
| PTY  | 30,364 / 7,333 | -999             | 0              | 0           |
| POP  | 9,295 / 28,402 | -99              | 0·20·30        | 0           |
| PCP  | 9,295 / 28,402 | -99              | 0              | 0           |
| SNO  | 9,295 / 28,402 | -99              | 0              | 0           |
| REH  | 9,295 / 28,402 | -99              | 40~100         | 65          |
| WSD  | 30,364 / 7,333 | -99              | 0~12.4         | 0.7         |
| TMN  | 9,295 / 28,402 | -99              | -6~22          | 7           |
| TMX  | 9,295 / 28,402 | -99              | 3~24           | 21          |

이 개수와 범위는 해당 파일의 재현 기준이다. 다른 응답을 거부할 제약이나 모든 요소에 공통인 유효 격자 목록이 아니다. 전체 원본을 현재 Java 파서로 읽어 위 개수·범위·대표 좌표와 대조했다.

| 요소 | 원본 SHA-256                                                       |
| ---- | ------------------------------------------------------------------ |
| TMP  | `f4009b4abb5b98f71754d6bda8a7da7fda13b9d81c84fc400ad1bcb5d6ae0083` |
| SKY  | `c94992d951edf2a58228b046a006009458ee6d0233f78ec723abb641605021bf` |
| PTY  | `0a01f53f08e091444ae40a2296cd9d8304b64ece5efd23f4df29eb54d90f6328` |
| POP  | `ca2b1d9afd6b25ee53c42aaa9ecbd841c641fe75f4d747b5166cb7a239d65f13` |
| PCP  | `a9b70f6e4f7429a9f349f42421d96e8f6671394917041e81c9c8adfea80eaa26` |
| SNO  | `a9b70f6e4f7429a9f349f42421d96e8f6671394917041e81c9c8adfea80eaa26` |
| REH  | `9425c17ccace4631e805eec2802794175fa9f6630800a8ca29d5a2b857c2108a` |
| WSD  | `0bdce75c08898eb43fe8a110c0ea9b9c35e991f6e368d72d79f47e123e18b12f` |
| TMN  | `2c03c572b8cbc5cc4332d135f97ba183d93d62797ca91a2edb27bac0ca43fcaf` |
| TMX  | `c36bb224883136d80c88d8d569941b7961a0f42f6e3e725a4420c73e63b26d20` |

PCP와 SNO의 해시가 같은 이유는 이 발표분의 결측 위치와 모든 유효 숫자 0이 같기 때문이다. 요소 의미가 같다는 뜻은 아니다.

## 자동 테스트 자료와 재현 방법

[kma-grid-samples.csv](../../src/test/resources/weather/kma-grid-samples.csv)는 실제 원본에서 뽑은 72개 셀, 약 3KB다. `element,tmfc,tmef,index,nx,ny,raw_value`를 저장한다. 원본·인증키·요청 URL은 포함하지 않는다.

- 공통 위치: 인덱스 0·148·149·18,833·37,696. 각각 첫 셀·첫 행 끝·다음 행 시작·`(60, 127)`·마지막 셀이다.
- 요소별 위치: 최솟값·최댓값·0·-99·-999가 존재하면 각각 처음 나타나는 위치를 추가한다.
- SKY·PTY·POP는 관측한 모든 고유 숫자의 첫 위치도 추가한다. 중복 인덱스는 제거하고 오름차순으로 저장한다.
- 원본의 숫자 표기는 유지하되 토큰 주변 공백은 제거한다.

테스트는 발췌하지 않은 셀을 `-99`로 채워 37,697개 배열로 확장한다. 따라서 이 테스트용 배열의 유효 개수는 원본 전체의 유효 개수와 다르다. BOM·공백·19개 값마다 CRLF·마지막 쉼표를 합성해 원본 값과 좌표가 유지되는지 검사한다. 별도 테스트는 모든 셀을 대표 정상값으로 채워 유효 격자 수를 특정 샘플로 제한하지 않는지 확인한다.

`KmaGridParserTest`는 10개 요소의 빈 응답·개수 오류·빈 셀·문자·NaN/Infinity·전체 결측을 검사한다. `KmaGridParserContractTest`는 발췌값, 공식 SKY·PTY 코드, 소수와 음수, 일별 요소의 요청 시각 보존을 검사한다. 실제 API 호출 없이 실행할 수 있다.

```bash
cd backend
./gradlew test --tests 'com.jachwisunbae.weather.parser.*' --no-daemon
```

원본 보유자는 위 SHA-256을 확인한 뒤 다음 코드로 발췌 CSV를 재생성할 수 있다. 저장소 루트에서 실행하고 `RAW_DIRECTORY`에 원본 디렉터리를 지정한다. 결과는 임시 파일로 생성해 기존 fixture와 비교한다. 새로운 발표분을 쓸 때는 파일명·메타데이터·원본 대조 기준을 함께 갱신해야 한다.

```bash
RAW_DIRECTORY=/path/to/kma-probe python3 - <<'PY' > /tmp/kma-grid-samples.csv
import csv
import os
import sys
from pathlib import Path

root = Path(os.environ['RAW_DIRECTORY'])
rows = []
for element in ('TMP', 'SKY', 'PTY', 'POP', 'PCP', 'SNO', 'REH', 'WSD', 'TMN', 'TMX'):
    tmef = {'TMN': '2026102306', 'TMX': '2026102315'}.get(element, '2026102220')
    text = (root / f'2026102217_{tmef}_{element}.raw').read_text(encoding='utf-8')
    tokens = [token.strip() for token in text.strip().removesuffix(',').split(',')]
    assert len(tokens) == 37697
    values = list(map(float, tokens))
    valid = [value for value in values if value not in (-99, -999)]
    targets = {min(valid), max(valid), 0, -99, -999}
    if element in ('SKY', 'PTY', 'POP'):
        targets.update(valid)
    indices = {0, 148, 149, 18833, 37696}
    indices.update(values.index(value) for value in targets if value in values)
    for index in sorted(indices):
        rows.append([element, '2026102217', tmef, index, index % 149 + 1, index // 149 + 1, tokens[index]])
writer = csv.writer(sys.stdout, lineterminator='\n')
writer.writerow(['element', 'tmfc', 'tmef', 'index', 'nx', 'ny', 'raw_value'])
writer.writerows(rows)
PY
diff -u backend/src/test/resources/weather/kma-grid-samples.csv /tmp/kma-grid-samples.csv
```

원본 전체의 Java 파싱을 다시 확인하려면 [실제 샘플 확인 방법](weather-collection.md#테스트와-실제-샘플-확인)에 각 요소의 파일과 요청 시각을 넣어 위 표와 대조한다. 원본은 저장소 밖에 보관하며 CI의 필수 입력으로 사용하지 않는다.
