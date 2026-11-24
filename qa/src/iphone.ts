import { get } from 'node:https';

import { type ConsoleMessage, type Locator, type Page, test as base, type TestInfo } from '@playwright/test';

// iPhone(WebKit) 경로 검증이 함께 쓰는 픽스처와 조작이다. 실행은 scripts/iphone.mjs 가 맡는다.
// - 모든 경로 끝에 콘솔 오류와 실패한 요청을 센다. 우리 출처(QA_BASE_URL)에서 난 것은 0이어야 통과한다.
//   네이버 지도 SDK와 타일처럼 우리가 고칠 수 없는 바깥 출처의 오류는 따로 세어 첨부와 주석으로 남긴다(판정에 쓰지 않는다).
// - QA_MAP_SDK=stub 이면 지도 SDK 주소를 map-sdk-stub.mjs(https://localhost:4443)로 돌린다. 지도는 뜨지 않으니
//   지도 위 요소를 보는 경로는 이유를 남기고 건너뛴다.

const ANALYTICS_URL = /posthog\.com/;
const MAP_SDK_URL = 'https://oapi.map.naver.com/**';
const MAP_SDK_STUB = 'https://localhost:4443';
export const MAP_SDK_MODE = process.env.QA_MAP_SDK === 'stub' ? 'stub' : 'real';
export const MAP_SKIP_REASON = '지도 SDK 목(stub)으로 돌아 지도가 뜨지 않는다. 지도 키를 주고 실제 SDK로 돌린다.';

type Problem = { kind: 'console' | 'requestfailed' | 'http'; url: string; text: string };

type IphoneFixtures = {
  /** 이 경로에서 생긴 콘솔 오류와 실패한 요청. 모든 경로에 자동으로 붙고, 경로가 끝나면 검사한다. */
  problems: Problem[];
  /** 경로 끝 화면을 runs/iphone/shots/<이름>.png 로 남기고 리포트에 붙인다. */
  shot: (name: string) => Promise<void>;
};

const fetchStub = (url: string) =>
  new Promise<{ status: number; body: Buffer; contentType: string }>((done, fail) => {
    const target = new URL(url);
    get(`${MAP_SDK_STUB}${target.pathname}${target.search}`, { rejectUnauthorized: false }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        done({
          status: response.statusCode ?? 502,
          body: Buffer.concat(chunks),
          contentType: response.headers['content-type'] ?? 'text/javascript',
        }),
      );
    }).on('error', fail);
  });

const URL_IN_TEXT = /https?:\/\/[^\s)]+/;

/**
 * 문제가 난 주소를 정한다. WebKit은 바깥 출처 CORS 실패를 콘솔에 주소 없이 남기기도 한다
 * (`Origin ... is not allowed by Access-Control-Allow-Origin. Status code: 400`). 그 줄은 같은 문구로 실패한 요청의 주소를 쓴다.
 */
const sourceOf = (problem: Problem, problems: Problem[]) => {
  if (problem.url !== '') return problem.url;
  // 문구 안의 주소는 요청 주소가 아닐 수 있다(`Origin <우리 주소> is not allowed`). 같은 문구의 실패한 요청을 먼저 본다.
  const failed = problems.find((other) => other.kind === 'requestfailed' && other.text === problem.text);
  if (failed !== undefined) return failed.url;
  return URL_IN_TEXT.exec(problem.text)?.[0] ?? '';
};

export const test = base.extend<IphoneFixtures>({
  context: async ({ context, baseURL }, use) => {
    if (new URL(baseURL ?? 'http://invalid').hostname !== 'localhost') {
      throw new Error(
        `iPhone 경로는 목 데이터를 전제로 로컬 목 서버에만 붙는다: ${baseURL}. npm run test:iphone 으로 돈다.`,
      );
    }
    await context.route(ANALYTICS_URL, (route) => route.abort());
    if (MAP_SDK_MODE === 'stub') {
      await context.route(MAP_SDK_URL, async (route) => {
        const { status, body, contentType } = await fetchStub(route.request().url());
        await route.fulfill({ status, body, contentType });
      });
    }
    await use(context);
  },
  problems: [
    async ({ page, baseURL }, use, testInfo) => {
      const origin = new URL(baseURL ?? 'http://localhost').origin;
      const problems: Problem[] = [];
      page.on('console', (message: ConsoleMessage) => {
        if (message.type() === 'error')
          problems.push({ kind: 'console', url: message.location().url, text: message.text() });
      });
      page.on('requestfailed', (request) => {
        problems.push({ kind: 'requestfailed', url: request.url(), text: request.failure()?.errorText ?? '' });
      });
      page.on('response', (response) => {
        if (response.status() >= 400)
          problems.push({ kind: 'http', url: response.url(), text: String(response.status()) });
      });
      await use(problems);
      await reportProblems(problems, origin, testInfo);
    },
    { auto: true },
  ],
  shot: async ({ page }, use, testInfo) => {
    await use(async (name: string) => {
      const path = `runs/iphone/shots/${name}.png`;
      await page.screenshot({ path });
      await testInfo.attach(name, { path, contentType: 'image/png' });
    });
  },
});

const reportProblems = async (problems: Problem[], origin: string, testInfo: TestInfo) => {
  const located = problems.map((problem) => ({ ...problem, url: sourceOf(problem, problems) }));
  // 주소를 끝내 모르는 오류는 우리 것으로 본다(놓치지 않는 쪽).
  const ours = located.filter((problem) => problem.url === '' || problem.url.startsWith(origin));
  const external = located.filter((problem) => !ours.includes(problem));
  await testInfo.attach('problems.json', {
    body: JSON.stringify({ ours, external }, null, 2),
    contentType: 'application/json',
  });
  if (external.length > 0) {
    const hosts = [...new Set(external.map((problem) => new URL(problem.url).host))].join(', ');
    testInfo.annotations.push({ type: '바깥 출처 오류', description: `${external.length}건 (${hosts})` });
  }
  // 경로가 이미 실패했으면 그 원인을 가리지 않는다.
  if (testInfo.status !== testInfo.expectedStatus) return;
  base
    .expect(
      ours.map((problem) => `${problem.kind} ${problem.text} ${problem.url}`),
      '우리 출처의 콘솔 오류와 실패한 요청은 0이어야 한다',
    )
    .toEqual([]);
};

/** 첫 방문 안내 말풍선의 `확인`을 누른다. 안내가 없으면 그냥 지나간다. */
export const dismissGuide = async (page: Page) => {
  await page
    .getByRole('button', { name: '확인', exact: true })
    .click({ timeout: 8_000 })
    .catch(() => undefined);
};

/**
 * 손가락으로 끄는 것을 흉내 낸다. Playwright의 터치 입력은 탭만 있어 포인터(마우스) 끌기로 움직인다.
 * 앱의 시트와 지도는 Pointer Events로 끌기를 받으므로 같은 코드 경로를 지난다(실제 터치 이벤트 순서와는 다를 수 있다).
 */
export const dragBy = async (page: Page, target: Locator, dx: number, dy: number) => {
  const box = await target.boundingBox();
  if (box === null) throw new Error('끌 대상이 화면에 없다');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
};

export { expect } from '@playwright/test';
