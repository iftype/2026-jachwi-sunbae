// CI(.github/workflows/visual-verdict.yml)의 자동 화면 판정. 숫자는 이 스크립트들이 내고 LLM은 쓰지 않는다.
// 전(base)과 후(head) 빌드를 serve.mjs 로, 지도 SDK 자리를 map-sdk-stub.mjs 로 띄운 뒤 부른다.
// 사용:
//   node .claude/skills/verify-jachwi/scripts/ci-verdict.mjs --scope <visual-scope --json 결과 파일> \
//     --before http://localhost:4301 --after http://localhost:4302 --out <폴더> [--mode pr|all] [--title "<PR 제목>"] \
//     [--runs 5] [--spread-factor 1.5] [--min-diff 100] [--before-label <커밋>] [--after-label <커밋>] [--run-url <실행 주소>]
// - pr: 영향 라우트 중 screens.mjs 순서로 가장 앞선 화면 하나만 잰다(PR마다 5분 안). all: 영향 화면 전부(visual-verdict-full.yml, 주 1회와 수동 실행).
// - 결과: <out>/<화면>/(verdict.md, runs.jsonl, result.json, shots, side), <out>/comment.md(PR 댓글), <out>/summary.json
// - 끝 코드: frontend/scripts/visual-scope.mjs 의 checkVerdict 가 실패를 내면 1(나빠짐, 같음이 아닌 리팩터링), 그 밖은 0.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { checkVerdict } from '../../../../frontend/scripts/visual-scope.mjs';
import { pickScreens } from './screens.mjs';

const { values: args } = parseArgs({
  options: {
    scope: { type: 'string' },
    before: { type: 'string' },
    after: { type: 'string' },
    out: { type: 'string' },
    mode: { type: 'string', default: 'pr' },
    title: { type: 'string', default: '' },
    runs: { type: 'string', default: '5' },
    'spread-factor': { type: 'string', default: '1' },
    'min-diff': { type: 'string', default: '0' },
    'before-label': { type: 'string', default: 'base' },
    'after-label': { type: 'string', default: 'head' },
    'run-url': { type: 'string', default: '' },
    'map-sdk': { type: 'string', default: 'stub' },
  },
});
if (!args.scope || !args.before || !args.after || !args.out)
  throw new Error('--scope, --before, --after, --out 이 필요하다');

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(args.out);
mkdirSync(out, { recursive: true });
const scope = JSON.parse(readFileSync(args.scope, 'utf8'));
const isRefactor = /\[Refactor\]/i.test(args.title);
const marker = '<!-- visual-verdict -->';
const seconds = (ms) => (ms === null || ms === undefined ? '-' : `${(ms / 1000).toFixed(2)}초`);
const signed = (ms) => (ms === undefined ? '-' : `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(2)}초`);

const finish = (summary, lines) => {
  writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join(out, 'comment.md'), `${marker}\n${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  if (summary.failures.length > 0) {
    summary.failures.forEach((failure) => console.error(`::error::${failure}`));
    process.exitCode = 1;
  }
};

const header = [
  '## 화면 판정 (CI 자동)',
  '',
  `- 전: \`${args['before-label']}\`, 후: \`${args['after-label']}\` (커밋을 더 올리면 그 커밋으로 다시 잰다)`,
];

if (!scope.runs) {
  finish({ verdict: '대상 아님', failures: [], screens: [] }, [
    ...header,
    `- 결과: 화면 판정 대상 아님 (${scope.why})`,
  ]);
} else {
  const candidates = pickScreens(scope);
  const screens = args.mode === 'all' ? candidates : candidates.slice(0, 1);
  if (screens.length === 0) {
    finish({ verdict: '잴 화면 없음', failures: [], screens: [] }, [
      ...header,
      `- 영향 라우트: ${scope.routes.join(', ')}`,
      '- 결과: 잴 화면 없음. 영향 라우트에 사용자 기준 순간이 정해진 화면이 없다. `.claude/skills/verify-jachwi/scripts/screens.mjs`에 더한다.',
    ]);
  } else {
    const results = screens.map((screen) => {
      const dir = join(out, screen.name);
      execFileSync(
        process.execPath,
        [
          join(here, 'measure.mjs'),
          ...['--before', args.before, '--after', args.after, '--screen', screen.name],
          ...['--runs', args.runs, '--net', 'fast4g', '--viewport', 'desktop', '--map-sdk', args['map-sdk']],
          // 순간을 못 보는 회차가 5분을 넘기지 않게 15초에 끊는다. CI 러너는 전용이라 부하를 기다리지 않는다.
          ...['--timeout', '15', '--max-load', '0'],
          // 순간이 1~3초 사이라 그 앞뒤를 촘촘히 찍는다.
          ...['--shots', '1,1.5,2,2.5,3,4'],
          ...['--spread-factor', args['spread-factor'], '--min-diff', args['min-diff'], '--out', dir],
        ],
        { stdio: 'inherit' },
      );
      execFileSync(
        process.execPath,
        [join(here, 'compare.mjs'), join(dir, 'shots/before'), join(dir, 'shots/after'), join(dir, 'side')],
        {
          stdio: 'inherit',
        },
      );
      const { result, verdict } = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
      return { screen, result, verdict };
    });
    const order = ['나빠짐', '판정 불가(흔들림 큼)', '판정 못 함', '좋아짐', '같음'];
    const overall = order.find((verdict) => results.some((item) => item.verdict === verdict)) ?? '같음';
    const failures = checkVerdict({ title: args.title, verdict: overall });
    const skipped = candidates.length - screens.length;
    const table = results.map(
      ({ screen, result, verdict }) =>
        `| \`${screen.url}\` | ${screen.moment.label} | ${seconds(result.moment.beforeMedian)} | ${seconds(result.moment.afterMedian)} | ${signed(result.moment.diff)} | ${seconds(result.moment.threshold)} | ${verdict} |`,
    );
    finish(
      { verdict: overall, failures, screens: results.map(({ screen, verdict }) => ({ screen: screen.name, verdict })) },
      [
        ...header,
        `- 결과: **${overall}**`,
        `- 영향 라우트: ${scope.scope === 'all' ? `주요 화면 전체(${scope.why})` : scope.routes.join(', ')}`,
        `- 조건: 운영 빌드, MSW 목(응답 300ms 고정), 데스크탑 1440x900, 보통 4G(지연 70ms, 9Mbps), CPU 4배, 빈 캐시, 데우기 1회 뒤 전후 번갈아 각 ${args.runs}회, 지도 SDK는 무게만 같은 목(지도는 뜨지 않아 지도와 무관한 순간만 잰다)`,
        `- 문턱: 흩어짐의 ${args['spread-factor']}배, ${seconds(Number(args['min-diff']))} 중 큰 값. 차이가 문턱 이하면 같음이다.`,
        '',
        '| 화면 | 사용자 기준 순간 | 전 중앙값 | 후 중앙값 | 차이 | 문턱 | 판정 |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        ...table,
        '',
        ...(skipped > 0
          ? [
              `- PR마다는 가장 중요한 화면 하나만 잰다. 영향 화면 ${skipped}개는 더 재지 않았다. 화면 전부는 주 1회 \`Visual Verdict Full\`이 develop에서 잰다. 이 PR에서 더 보려면 로컬에서 \`measure.mjs --screen <화면>\`으로 잰다.`,
            ]
          : []),
        ...(isRefactor ? ['- 리팩터링 PR이라 "같음"이어야 통과다.'] : []),
        ...(failures.length > 0 ? failures.map((failure) => `- 실패: ${failure}`) : []),
        args['run-url']
          ? `- 증거: [실행 기록과 아티팩트(verdict.md, 같은 시각 전후 스크린샷)](${args['run-url']})`
          : '- 증거: 아티팩트 visual-verdict',
        '- 모양을 일부러 바꾸는 UI PR이면 같은 시각 나란히 보기(`side/*.side.png`)는 코드 맥락 없는 별도 에이전트가 verify-jachwi 스킬로 본다.',
      ],
    );
  }
}
