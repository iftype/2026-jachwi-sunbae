// 갈 수 있는 주요 화면마다 데스크탑과 휴대폰 폭으로 기준 스크린샷을 찍는다. 같은 조건으로 전과 후를 찍어 compare.mjs로 견준다.
// 사용:
//   node .claude/skills/verify-jachwi/scripts/baseline.mjs --base http://localhost:4301 --out qa/runs/verify-jachwi/baseline-before
//   (고른 화면만) --only /,/properties/:propertyId      (affected-routes.mjs가 낸 라우트 패턴을 쉼표로)
// 전제: serve.mjs --api mock --delay 300 으로 띄운 빌드. 목 데이터와 고정 응답 시간이라 찍을 때마다 같은 화면이 나온다.
// 기준 이미지는 레포에 커밋하지 않는다(qa/runs는 git 제외). 출력: <out>/<화면>-<desktop|mobile>.png, <out>/screens.md
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string' },
    out: { type: 'string' },
    only: { type: 'string' },
    settle: { type: 'string', default: '2500' },
    chrome: { type: 'string', default: process.env.CHROME_PATH },
  },
});
if (!args.base || !args.out) throw new Error('--base, --out 이 필요하다');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(join(repoRoot, 'qa/package.json'));
const { chromium } = (await import(pathToFileURL(require.resolve('@playwright/test')).href)).default;
const { classifyRoutes, findReachableRoute } = await import(
  pathToFileURL(join(repoRoot, 'frontend/scripts/reachable-routes.mjs')).href
);

// 주요 화면. 주소의 id는 MSW 목 데이터(frontend/src/app/mocks/fixtures)에 있는 값이다.
// 라우트가 바뀌면 여기를 고친다. 갈 수 없는 화면은 넣지 않는다(넣어도 아래 확인에서 빠진다).
export const SCREENS = [
  { name: 'home', url: '/' },
  { name: 'neighborhoods', url: '/neighborhoods' },
  { name: 'explore', url: '/explore' },
  { name: 'property-detail', url: '/properties/11' },
  { name: 'property-edit', url: '/properties/11/edit' },
  { name: 'property-photos', url: '/properties/11/photos' },
  { name: 'checklists', url: '/checklists' },
  { name: 'checklist-detail', url: '/checklists/9' },
  { name: 'checklist-new', url: '/checklists/new' },
  { name: 'compare', url: '/compare' },
  { name: 'cheap-meals', url: '/cheap-meals/restaurant' },
  { name: 'me', url: '/me' },
  { name: 'guide', url: '/guide' },
  { name: 'search', url: '/search' },
  { name: 'landing', url: '/landing' },
  { name: 'privacy', url: '/privacy' },
];

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};

const routes = await classifyRoutes();
const only = args.only ? new Set(args.only.split(',')) : undefined;
const out = resolve(args.out);
mkdirSync(out, { recursive: true });
const lines = [];
const browser = await chromium.launch(args.chrome ? { executablePath: args.chrome } : {});
for (const screen of SCREENS) {
  const route = findReachableRoute(routes, screen.url);
  if (route?.kind !== 'reachable' && route?.kind !== 'exception') {
    lines.push(`| ${screen.name} | ${screen.url} | 갈 수 없는 화면이라 찍지 않음 |`);
    continue;
  }
  if (only && !only.has(route.path)) continue;
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ ...viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    page.on('response', (response) => response.status() >= 400 && errors.push(`${response.status()} ${response.url()}`));
    await page.goto(new URL(screen.url, args.base).href, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(Number(args.settle));
    const file = `${screen.name}-${viewportName}.png`;
    await page.screenshot({ path: join(out, file), animations: 'disabled', caret: 'hide' });
    lines.push(`| ${screen.name} | ${screen.url} | ${file}, 오류 ${errors.length}${errors.length > 0 ? ` (${[...new Set(errors)].slice(0, 3).join('; ').slice(0, 300)})` : ''} |`);
    console.log(file, page.url().replace(args.base, ''), `오류 ${errors.length}`);
    await context.close();
  }
}
await browser.close();
writeFileSync(join(out, 'screens.md'), `| 화면 | 주소 | 결과 |\n| --- | --- | --- |\n${lines.join('\n')}\n`);
