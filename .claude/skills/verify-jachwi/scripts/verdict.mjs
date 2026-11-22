// measure.mjs 결과(runs.jsonl)로 전후를 판정한다. 다시 계산만 할 때: node verdict.mjs <runs.jsonl>
// 판정 규칙(SKILL.md의 "전후 판정"과 같다):
// - 흩어짐 = 전과 후 각각의 범위(최대 - 최소) 중 큰 값.
// - 문턱 = max(흩어짐 x 배수, 최소 차이). 로컬 기본은 배수 1, 최소 차이 0이다. CI는 develop 대 develop 시험으로 정한 값을 준다.
// - 후 중앙값 - 전 중앙값의 크기가 문턱 이하면 "같음", 그보다 작아졌으면 "좋아짐", 커졌으면 "나빠짐".
// - 순간을 못 본 회차(시간 초과)가 후에서 더 많으면 값과 상관없이 "나빠짐".
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const range = (values) => Math.max(...values) - Math.min(...values);

export const compareMetric = (beforeValues, afterValues, { spreadFactor = 1, minDiff = 0 } = {}) => {
  const before = beforeValues.filter((value) => value !== null);
  const after = afterValues.filter((value) => value !== null);
  const missingBefore = beforeValues.length - before.length;
  const missingAfter = afterValues.length - after.length;
  if (before.length === 0 || after.length === 0) {
    return {
      before,
      after,
      missingBefore,
      missingAfter,
      verdict: missingAfter > missingBefore ? '나빠짐' : '판정 못 함',
    };
  }
  const diff = median(after) - median(before);
  const spread = Math.max(range(before), range(after));
  const threshold = Math.max(spread * spreadFactor, minDiff);
  let verdict = '같음';
  if (missingAfter > missingBefore) verdict = '나빠짐';
  else if (Math.abs(diff) > threshold) verdict = diff < 0 ? '좋아짐' : '나빠짐';
  return {
    before,
    after,
    missingBefore,
    missingAfter,
    beforeMedian: median(before),
    afterMedian: median(after),
    diff,
    spread,
    threshold,
    verdict,
  };
};

export const judge = (rows, options = {}) => {
  const side = (variant) => rows.filter((row) => row.variant === variant);
  const pick = (variant, key) => side(variant).map((row) => row[key]);
  const count = (variant, key) => side(variant).map((row) => row[key].length);
  return {
    moment: compareMetric(pick('before', 'moment'), pick('after', 'moment'), options),
    lcp: compareMetric(pick('before', 'lcp'), pick('after', 'lcp'), options),
    consoleErrors: { before: count('before', 'consoleErrors'), after: count('after', 'consoleErrors') },
    failedRequests: { before: count('before', 'failedRequests'), after: count('after', 'failedRequests') },
    samples: {
      consoleErrors: [
        ...new Set(rows.flatMap((row) => row.consoleErrors.map((text) => `${row.variant}: ${text}`))),
      ].slice(0, 10),
      failedRequests: [
        ...new Set(rows.flatMap((row) => row.failedRequests.map((text) => `${row.variant}: ${text}`))),
      ].slice(0, 10),
    },
  };
};

const seconds = (ms) => (ms === null || ms === undefined ? '-' : `${(ms / 1000).toFixed(2)}초`);
const signed = (ms) => (ms === undefined ? '-' : `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(2)}초`);
const list = (values) => values.map((value) => (value / 1000).toFixed(2)).join(', ');

const metricRow = (name, metric) =>
  `| ${name} | ${seconds(metric.beforeMedian)} | ${seconds(metric.afterMedian)} | ${signed(metric.diff)} | ${seconds(metric.spread)} | ${seconds(metric.threshold)} | ${metric.verdict} |`;

// 사용자 기준 판정. 콘솔 오류나 실패한 요청이 후에서 늘면 순간 값과 상관없이 나빠짐이다.
export const userVerdict = (result) => {
  const errorsWorse = Math.max(...result.consoleErrors.after) > Math.max(...result.consoleErrors.before);
  const failedWorse = Math.max(...result.failedRequests.after) > Math.max(...result.failedRequests.before);
  return errorsWorse || failedWorse ? '나빠짐' : result.moment.verdict;
};

export const renderVerdict = (setup, result) => {
  const verdict = userVerdict(result);
  return `# 전후 판정

- 화면: \`${setup.path}\` (${setup.viewport})
- 사용자가 기다리는 순간: ${setup.moment}
- 문턱: 흩어짐의 ${setup.spreadFactor ?? 1}배, ${seconds(setup.minDiff ?? 0)} 중 큰 값. 차이가 문턱 이하면 같음이다.
- 조건: 회선 ${setup.net}, CPU ${setup.cpu}배, 빈 캐시 첫 방문, 전후를 번갈아 각 ${setup.runs}회(세지 않는 데우기 ${setup.warmup ?? 0}회 뒤)${setup.mapSdk === 'stub' ? ', 지도 SDK는 무게만 같은 목(지도는 뜨지 않음)' : ''}
- 전: ${setup.before}, 후: ${setup.after}

## 판정: ${verdict}

사용자 기준 순간이 판정을 정한다. LCP는 참고만 한다. 콘솔 오류나 실패한 요청이 후에서 늘면 순간 값과 상관없이 나빠짐이다.

| 지표 | 전 중앙값 | 후 중앙값 | 차이 | 흩어짐 | 문턱 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
${metricRow('사용자 순간', result.moment)}
${metricRow('LCP(보조)', result.lcp)}

- 사용자 순간 회차별(초): 전 ${list(result.moment.before)}, 후 ${list(result.moment.after)}${result.moment.missingBefore + result.moment.missingAfter > 0 ? `, 못 본 회차 전 ${result.moment.missingBefore} 후 ${result.moment.missingAfter}` : ''}
- 콘솔 오류 수(회차별): 전 ${result.consoleErrors.before.join(', ')}, 후 ${result.consoleErrors.after.join(', ')}
- 실패한 요청 수(회차별, 4xx와 5xx 포함): 전 ${result.failedRequests.before.join(', ')}, 후 ${result.failedRequests.after.join(', ')}
${[...result.samples.consoleErrors.map((text) => `  - 콘솔: ${text}`), ...result.samples.failedRequests.map((text) => `  - 요청: ${text}`)].join('\n')}

## 같은 시각 나란히 보기

\`compare.mjs shots/before shots/after side\`로 같은 시각 전후를 나란히 붙이고 \`side/<N>s.side.png\`를 직접 연다. 늦게 뜨는 요소를 적는다.

| 시각 | 전에만 보이는 것 | 후에만 보이는 것 |
| --- | --- | --- |
${setup.shotTimes.map((time) => `| ${time}초 | (직접 보고 적는다) | (직접 보고 적는다) |`).join('\n')}

## PR 본문에 쓸 수 있는 말

${verdict === '좋아짐' ? '- 사용자 순간이 흩어짐보다 크게 빨라졌다. "개선"이라고 써도 된다.' : '- "개선"이라고 쓰지 않는다. 사용자 기준 순간이 좋아지지 않았다.'}
- 리팩터링 PR은 판정이 "같음"이어야 통과다.
`;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = readFileSync(process.argv[2], 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  console.log(JSON.stringify(judge(rows), null, 2));
}
