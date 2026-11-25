// iPhone(WebKit) 경로 검증을 한 번에 돈다. LLM과 에이전트는 쓰지 않는다.
// 사용(qa 폴더): npm run test:iphone [-- --dist <운영 빌드 dist>] [--port 4320] [--map auto|real|stub] [--skip-build]
//   데스크탑(Chromium 1440x900)은 npm run test:desktop(--device desktop), 둘 다는 --device all 이다.
//   1. 운영 빌드(webpack production)를 한 번 한다. --dist 를 주면 그 빌드를 쓴다. 빌드에 API 주소(http://localhost:<포트>)가 박힌다.
//   2. verify-jachwi 의 serve.mjs --api mock --delay 300 으로 띄운다. dev API는 쓰지 않는다.
//   3. 지도 키(NAVER_MAP_CLIENT_ID, 환경 변수나 frontend/.env.local)가 있으면 실제 SDK, 없으면 map-sdk-stub.mjs 로 돌린다.
//   4. Playwright 프로젝트(iphone: WebKit + iPhone 15, desktop: Chromium 1440x900)를 하나씩 돌리고
//      runs/<프로젝트>/summary.md 에 경로별 결과와 걸린 시간을 쓴다. 목 서버는 프로젝트마다 새로 띄운다(상태를 기억해서).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const qaDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = resolve(qaDir, '..');
const frontendDir = join(repoDir, 'frontend');
const scriptsDir = join(repoDir, '.claude/skills/verify-jachwi/scripts');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dist: { type: 'string' },
    port: { type: 'string', default: '4320' },
    map: { type: 'string', default: 'auto' },
    'skip-build': { type: 'boolean', default: false },
    device: { type: 'string', default: 'iphone' },
  },
});
const DEVICES = {
  iphone: { title: 'iPhone(WebKit)', browser: 'Playwright WebKit, iPhone 15 기기 설정' },
  desktop: { title: '데스크탑(Chromium)', browser: 'Playwright Chromium, 데스크탑 1440x900' },
};
const devices = args.device === 'all' ? Object.keys(DEVICES) : [args.device];
for (const device of devices) {
  if (!(device in DEVICES)) throw new Error(`--device 는 iphone, desktop, all 중 하나다: ${args.device}`);
}
const port = Number(args.port);
const baseUrl = `http://localhost:${port}`;

const readMapKey = () => {
  if (process.env.NAVER_MAP_CLIENT_ID) return process.env.NAVER_MAP_CLIENT_ID;
  const envFile = join(frontendDir, '.env.local');
  if (!existsSync(envFile)) return '';
  const line = readFileSync(envFile, 'utf-8')
    .split('\n')
    .find((text) => text.startsWith('NAVER_MAP_CLIENT_ID='));
  return line?.slice('NAVER_MAP_CLIENT_ID='.length).trim() ?? '';
};

const mapKey = readMapKey();
if (!['auto', 'real', 'stub'].includes(args.map)) throw new Error(`--map 은 auto, real, stub 중 하나다: ${args.map}`);
const mapMode = args.map === 'auto' ? (mapKey ? 'real' : 'stub') : args.map;
if (mapMode === 'real' && !mapKey) throw new Error('--map real 에는 NAVER_MAP_CLIENT_ID 가 필요하다');

const children = [];
const stopChildren = () => {
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
};
process.on('exit', stopChildren);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

const run = (command, commandArgs, options) =>
  new Promise((done, fail) => {
    const child = spawn(command, commandArgs, { stdio: 'inherit', ...options });
    child.on('exit', (code) => done(code ?? 1));
    child.on('error', fail);
  });

const startBackground = (name, commandArgs) => {
  const child = spawn(process.execPath, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
};

const waitFor = async (check, what) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await check().catch(() => false)) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`${what} 이(가) 60초 안에 뜨지 않았다`);
};

const seconds = (ms) => Math.round(ms / 100) / 10;
const timing = {};
const startedAt = Date.now();

// 1. 운영 빌드
const dist = args.dist ? resolve(args.dist) : join(frontendDir, 'dist');
if (!args.dist && !args['skip-build']) {
  const buildStarted = Date.now();
  const code = await run('npm', ['run', 'build:bundle', '--silent'], {
    cwd: frontendDir,
    env: {
      ...process.env,
      API_BASE_URL: baseUrl,
      // 키가 없을 때 운영 빌드는 그래도 네이버 지도를 부르므로 아무 값이나 넣고 SDK 주소를 목으로 돌린다(CI와 같다).
      NAVER_MAP_CLIENT_ID: mapKey || 'ci-map-sdk-stub',
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=1536',
    },
  });
  if (code !== 0) throw new Error('운영 빌드 실패');
  timing.build = seconds(Date.now() - buildStarted);
}
if (!existsSync(join(dist, 'index.html'))) throw new Error(`운영 빌드가 없다: ${dist}`);

// 2~4. 기기마다 목 서버를 새로 띄우고(목은 한 번 띄우는 동안 상태를 기억한다) Playwright를 돌린 뒤 요약을 쓴다.
const stopChild = (child) =>
  new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) return done();
    child.once('exit', () => done());
    child.kill('SIGTERM');
  });

const STATUS = { passed: '통과', failed: '실패', timedOut: '시간 초과', skipped: '건너뜀', interrupted: '중단' };
const collectRows = (reportFile) => {
  const rows = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const testResult of spec.tests) {
        const result = testResult.results.at(-1);
        const note = [
          ...new Set(
            [...(testResult.annotations ?? []), ...(result?.annotations ?? [])].map(
              (annotation) => `${annotation.type}: ${annotation.description ?? ''}`,
            ),
          ),
        ].join('<br>');
        const error = result?.error?.message?.split('\n')[0]?.replace(/\u001b\[[0-9;]*m/g, '') ?? '';
        rows.push({
          title: spec.title,
          status: STATUS[result?.status ?? 'skipped'] ?? result?.status,
          seconds: seconds(result?.duration ?? 0),
          note: [note, error].filter(Boolean).join('<br>'),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  if (existsSync(reportFile)) for (const suite of JSON.parse(readFileSync(reportFile, 'utf-8')).suites) walk(suite);
  return rows;
};

let exitCode = 0;
for (const device of devices) {
  const outDir = join(qaDir, 'runs', device);
  const deviceTiming = { ...timing };

  // 2. 서버
  const serveStarted = Date.now();
  const serve = startBackground('serve', [
    join(scriptsDir, 'serve.mjs'),
    '--dist',
    dist,
    '--port',
    String(port),
    '--api',
    'mock',
    '--delay',
    '300',
  ]);
  const stub =
    mapMode === 'stub' ? startBackground('map-sdk-stub', [join(scriptsDir, 'map-sdk-stub.mjs'), '--port', '4443']) : null;
  await waitFor(async () => (await fetch(baseUrl)).ok, `serve.mjs(${baseUrl})`);
  if (stub !== null) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    await waitFor(async () => (await fetch('https://localhost:4443/openapi/v3/maps-gl.js')).ok, 'map-sdk-stub');
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  }
  deviceTiming.serve = seconds(Date.now() - serveStarted);

  // 3. Playwright. 레포의 QA 리포터(AI 분석)는 부르지 않도록 리포터를 직접 정한다.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'shots'), { recursive: true });
  const reportFile = join(outDir, 'report.json');
  const testStarted = Date.now();
  const code = await run(
    'npx',
    ['playwright', 'test', `--project=${device}`, '--reporter=list,json,html', ...positionals],
    {
      cwd: qaDir,
      env: {
        ...process.env,
        QA_IPHONE: '1',
        QA_BASE_URL: baseUrl,
        QA_MAP_SDK: mapMode,
        QA_AI_ANALYSIS: 'off',
        PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
        PLAYWRIGHT_HTML_OPEN: 'never',
        PLAYWRIGHT_HTML_OUTPUT_DIR: join(outDir, 'html'),
      },
    },
  );
  if (code !== 0) exitCode = code;
  deviceTiming.test = seconds(Date.now() - testStarted);
  deviceTiming.total = seconds(Date.now() - startedAt);
  await stopChild(serve);
  if (stub !== null) await stopChild(stub);

  // 4. 요약
  const rows = collectRows(reportFile);
  const summary = [
    `# ${DEVICES[device].title} 경로 검증`,
    '',
    `- 조건: ${DEVICES[device].browser}, 운영 빌드(${relative(repoDir, dist) || dist}), serve.mjs --api mock --delay 300, 지도 SDK ${mapMode === 'real' ? '실제' : '목(map-sdk-stub)'}`,
    `- 걸린 시간(초): ${Object.entries(deviceTiming)
      .map(([name, value]) => `${name} ${value}`)
      .join(', ')}`,
    '',
    '| 경로 | 결과 | 시간(초) | 비고 |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.title} | ${row.status} | ${row.seconds} | ${row.note.replaceAll('|', '\\|')} |`),
    '',
    `스크린샷: \`runs/${device}/shots/\`, 리포트: \`runs/${device}/html/\`(npx playwright show-report runs/${device}/html)`,
    '',
  ].join('\n');
  writeFileSync(join(outDir, 'summary.md'), summary);
  writeFileSync(join(outDir, 'timing.json'), JSON.stringify({ mapMode, ...deviceTiming }, null, 2));
  console.log(`\n${summary}`);
}
stopChildren();
process.exit(exitCode);
