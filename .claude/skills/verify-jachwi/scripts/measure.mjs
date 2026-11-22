// 전후 판정용 측정. 같은 화면을 전과 후 빌드에서 번갈아 여러 번 열고, 사용자가 기다리는 순간이 언제 보였는지 잰다.
// 사용:
//   node .claude/skills/verify-jachwi/scripts/measure.mjs \
//     --before http://localhost:4301 --after http://localhost:4302 --path / --moment card \
//     --runs 5 --net fast4g --viewport mobile --out qa/runs/verify-jachwi/verdict-<이름>
// 결과: <out>/runs.jsonl(회차별 값), <out>/shots/<before|after>/<N>s.png(같은 시각 스크린샷), <out>/verdict.md(판정 초안),
//       <out>/result.json(조건과 판정, CI가 읽는다)
// --map-sdk stub: 네이버 지도 SDK 주소를 map-sdk-stub.mjs(--map-sdk-port)로 돌린다. 키가 없는 CI에서 쓴다. 지도는 뜨지 않으니
//   지도와 무관한 순간만 잰다. real(기본)은 실제 SDK라 빌드에 쓸 수 있는 키가 있어야 한다.
// 스크린샷은 시간을 재는 회차와 따로 한 번 더 열어 찍는다. 찍는 일이 시간 측정을 흔들지 않게 하려는 것이다.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadavg } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { findScreen } from './screens.mjs';
import { judge, renderVerdict, userVerdict } from './verdict.mjs';

const { values: args } = parseArgs({
  options: {
    before: { type: 'string' },
    after: { type: 'string' },
    path: { type: 'string', default: '/' },
    moment: { type: 'string', default: 'card' },
    selector: { type: 'string' },
    text: { type: 'string' },
    screen: { type: 'string' },
    'spread-factor': { type: 'string', default: '1' },
    'min-diff': { type: 'string', default: '0' },
    // 1분 평균 부하가 이 값을 넘으면 내려올 때까지 기다린다(다른 일을 하는 노트북용). 0이면 기다리지 않는다(CI 전용 러너).
    'max-load': { type: 'string', default: '3' },
    runs: { type: 'string', default: '5' },
    net: { type: 'string', default: 'fast4g' },
    viewport: { type: 'string', default: 'mobile' },
    shots: { type: 'string', default: '2,4,6,8' },
    timeout: { type: 'string', default: '30' },
    out: { type: 'string' },
    chrome: { type: 'string', default: process.env.CHROME_PATH },
    'map-sdk': { type: 'string', default: 'real' },
    'map-sdk-port': { type: 'string', default: '4443' },
  },
});
if (!args.before || !args.after || !args.out) throw new Error('--before, --after, --out 이 필요하다');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(join(repoRoot, 'qa/package.json'));
const { chromium } = (await import(pathToFileURL(require.resolve('@playwright/test')).href)).default;

// 회선 조건. fast4g가 "보통 4G"다(DevTools Fast 4G와 비슷하게 지연 70ms, 내려받기 9Mbps). CPU는 휴대폰을 흉내 내 4배 느리게 한다.
export const NETWORKS = {
  fast4g: { net: { offline: false, latency: 70, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 }, cpu: 4 },
  slow4g: {
    net: { offline: false, latency: 562.5, downloadThroughput: 1.47e6 / 8, uploadThroughput: 1.47e6 / 8 / 3 },
    cpu: 4,
  },
  none: { net: null, cpu: 1 },
};

// 사용자가 기다리는 순간. 보이는 요소가 화면 안에 들어오고, 이미지면 디코딩까지 끝난 뒤 두 프레임 지난 시각을 잰다.
// 새 화면을 판정할 때는 여기에 더하거나 --selector 로 준다. 지도 배경, LCP는 보조 지표라 순간으로 쓰지 않는다.
// mapFree: 지도 SDK 없이도 뜨는 순간이다. 지도 목(--map-sdk stub)으로 재는 CI는 이것만 쓴다.
export const MOMENTS = {
  card: {
    label: '첫 매물 카드(사진이 보인 매물 카드나 지도 매물 표시)',
    selector: '[data-tone="property"] img, article img',
  },
  'list-card': {
    label: '목록의 첫 매물 카드(사진 자리까지 보인 카드)',
    selector: 'article img',
    mapFree: true,
  },
  'area-chips': {
    label: '기록한 동네 칩(매물 수가 보인 칩)',
    selector: 'nav[aria-label="기록한 동네"] button span',
    mapFree: true,
  },
};

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

// --screen 은 screens.mjs 의 화면(이름이나 라우트)에서 주소와 순간을 가져온다. CI가 쓴다.
const screen = args.screen ? findScreen(args.screen) : undefined;
if (args.screen && !screen?.moment) throw new Error(`순간이 정해지지 않은 화면: ${args.screen}. screens.mjs 에 더한다`);
const path = screen ? screen.url : args.path;
const moment = screen
  ? screen.moment
  : args.selector
    ? { label: args.text ? `${args.selector} (${args.text})` : args.selector, selector: args.selector, text: args.text }
    : MOMENTS[args.moment];
if (!moment) throw new Error(`모르는 순간: ${args.moment}. --selector 로 CSS 선택자를 준다`);
const condition = NETWORKS[args.net];
if (!condition) throw new Error(`모르는 회선: ${args.net}`);
if (!['real', 'stub'].includes(args['map-sdk']))
  throw new Error(`--map-sdk 는 real 이나 stub 이다: ${args['map-sdk']}`);
const stubMapSdk = args['map-sdk'] === 'stub';
const shotTimes = args.shots.split(',').map(Number);
const out = resolve(args.out);
mkdirSync(join(out, 'shots', 'before'), { recursive: true });
mkdirSync(join(out, 'shots', 'after'), { recursive: true });
const runsFile = join(out, 'runs.jsonl');
writeFileSync(runsFile, '');

const watchMoment = ({ selector, text }) => {
  const textPattern = text ? new RegExp(text) : null;
  const m = { at: null, what: null, lcp: null };
  window.__verify = m;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) m.lcp = entry.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  const inView = (element) => {
    const r = element.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const check = () => {
    if (m.at !== null) return;
    for (const element of document.querySelectorAll(selector)) {
      if (!inView(element)) continue;
      if (textPattern && !textPattern.test(element.textContent ?? '')) continue;
      if (element instanceof HTMLImageElement && !(element.complete && element.naturalWidth > 0)) continue;
      m.at = -1;
      const decoded = element instanceof HTMLImageElement ? element.decode().catch(() => {}) : Promise.resolve();
      decoded.then(() =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            m.at = performance.now();
            m.what = element.outerHTML.slice(0, 120);
          }),
        ),
      );
      return;
    }
  };
  new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true });
  document.addEventListener('load', check, true);
};

const waitForQuietMachine = async () => {
  const maxLoad = Number(args['max-load']);
  if (maxLoad <= 0) return;
  for (let i = 0; i < 40 && loadavg()[0] > maxLoad; i += 1) await new Promise((done) => setTimeout(done, 3000));
};

const openOnce = async (browser, baseUrl, { shotsPrefix } = {}) => {
  const context = await browser.newContext({ ...VIEWPORTS[args.viewport], ignoreHTTPSErrors: stubMapSdk });
  await context.addInitScript(watchMoment, { selector: moment.selector, text: moment.text });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text().slice(0, 200)));
  page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 200)));
  page.on('requestfailed', (request) =>
    failedRequests.push(`${request.failure()?.errorText} ${request.url().slice(0, 120)}`),
  );
  page.on(
    'response',
    (response) =>
      response.status() >= 400 && failedRequests.push(`${response.status()} ${response.url().slice(0, 120)}`),
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  if (condition.net) await cdp.send('Network.emulateNetworkConditions', condition.net);
  if (condition.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: condition.cpu });
  const started = Date.now();
  page.goto(new URL(path, baseUrl).href, { waitUntil: 'commit' }).catch(() => {});
  if (shotsPrefix) {
    for (const seconds of shotTimes) {
      const wait = started + seconds * 1000 - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      await page.screenshot({ path: join(out, 'shots', shotsPrefix, `${seconds}s.png`) }).catch(() => {});
    }
  }
  const deadline = started + Number(args.timeout) * 1000;
  let result = null;
  while (Date.now() < deadline) {
    result = await page.evaluate(() => window.__verify).catch(() => null);
    if (result?.at > 0) break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1500);
  const final = await page.evaluate(() => window.__verify).catch(() => result);
  await context.close();
  return {
    moment: final?.at > 0 ? Math.round(final.at) : null,
    what: final?.what ?? null,
    lcp: final?.lcp ? Math.round(final.lcp) : null,
    consoleErrors,
    failedRequests,
  };
};

const browser = await chromium.launch({
  ...(args.chrome ? { executablePath: args.chrome } : {}),
  args: stubMapSdk ? [`--host-resolver-rules=MAP oapi.map.naver.com 127.0.0.1:${args['map-sdk-port']}`] : [],
});
const variants = [
  ['before', args.before],
  ['after', args.after],
];
const runs = Number(args.runs);
for (let run = 1; run <= runs; run += 1) {
  // 앞뒤 순서를 회차마다 바꾼다. 늘 먼저 여는 쪽이 손해나 이득을 보지 않게 한다.
  const order = run % 2 === 1 ? variants : [...variants].reverse();
  for (const [variant, baseUrl] of order) {
    await waitForQuietMachine();
    const load = loadavg()[0];
    const measured = await openOnce(browser, baseUrl);
    const row = { variant, run, load: Number(load.toFixed(2)), ...measured };
    appendFileSync(runsFile, `${JSON.stringify(row)}\n`);
    console.log(
      variant,
      run,
      'moment',
      measured.moment,
      'lcp',
      measured.lcp,
      'errors',
      measured.consoleErrors.length,
      'failed',
      measured.failedRequests.length,
    );
  }
}
for (const [variant, baseUrl] of variants) await openOnce(browser, baseUrl, { shotsPrefix: variant });
await browser.close();

const rows = readFileSync(runsFile, 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const setup = {
  path,
  screen: screen?.name,
  spreadFactor: Number(args['spread-factor']),
  minDiff: Number(args['min-diff']),
  moment: moment.label,
  net: args.net,
  cpu: condition.cpu,
  viewport: args.viewport,
  runs,
  before: args.before,
  after: args.after,
  shotTimes,
  mapSdk: args['map-sdk'],
};
const result = judge(rows, { spreadFactor: setup.spreadFactor, minDiff: setup.minDiff });
writeFileSync(join(out, 'verdict.md'), renderVerdict(setup, result));
writeFileSync(
  join(out, 'result.json'),
  `${JSON.stringify({ setup, result, verdict: userVerdict(result) }, null, 2)}\n`,
);
console.log(`판정 초안: ${join(out, 'verdict.md')}`);
