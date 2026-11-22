// 운영 빌드(dist)를 정적으로 내보내고 /api 를 MSW 목이나 dev API로 답하는 서버다. 전후 판정과 기준 스크린샷에 쓴다.
// 사용: node .claude/skills/verify-jachwi/scripts/serve.mjs --dist <dist 폴더> --port 4301 [--api mock|dev] [--delay 300]
// - mock: 이 레포 frontend/src/app/mocks/handlers 를 Node에서 그대로 돌리고, 모든 /api 응답을 --delay ms 뒤에 보낸다.
//   서비스 워커가 아니라 진짜 HTTP 응답이라 DevTools 회선 제한이 API에도 걸린다. 전과 후가 같은 목 데이터를 받는다.
// - dev: /api 를 https://dev-api.jachwi-sunbae.kr 로 중계하고 Origin 헤더를 지운다(dev 서버의 프록시와 같다).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    dist: { type: 'string' },
    port: { type: 'string', default: '4301' },
    api: { type: 'string', default: 'mock' },
    delay: { type: 'string', default: '300' },
  },
});
if (!args.dist) throw new Error('--dist 가 필요하다');
const dist = resolve(args.dist);
const port = Number(args.port);
const delayMs = Number(args.delay);
const devApi = 'https://dev-api.jachwi-sunbae.kr';
const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../frontend');

const loadMockHandlers = async () => {
  const require = createRequire(join(frontendDir, 'package.json'));
  const vite = await import(pathToFileURL(require.resolve('vite')).href);
  const msw = await import(pathToFileURL(require.resolve('msw')).href);
  const { module } = await vite.runnerImport(join(frontendDir, 'src/app/mocks/handlers/index.ts'), {
    configFile: false,
    root: frontendDir,
    logLevel: 'error',
    resolve: { alias: { '@': join(frontendDir, 'src') } },
  });
  return { handlers: module.handlers, getResponse: msw.getResponse };
};

const mock = args.api === 'mock' ? await loadMockHandlers() : undefined;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

const readBody = (req) =>
  new Promise((done) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => done(chunks.length > 0 ? Buffer.concat(chunks) : undefined));
  });

const sendFetchResponse = async (res, response) => {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
};

const answerApi = async (req, res, url) => {
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
  const headers = Object.fromEntries(
    Object.entries(req.headers).filter(([key]) => !['host', 'origin', 'connection', 'content-length'].includes(key)),
  );
  if (!mock) {
    const response = await fetch(`${devApi}${url.pathname}${url.search}`, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });
    const forwarded = new Headers(response.headers);
    forwarded.delete('content-encoding');
    forwarded.delete('content-length');
    await sendFetchResponse(res, new Response(response.body, { status: response.status, headers: forwarded }));
    return;
  }
  const request = new Request(url, { method: req.method, headers, body });
  const [response] = await Promise.all([
    mock.getResponse(mock.handlers, request),
    new Promise((done) => setTimeout(done, delayMs)),
  ]);
  await sendFetchResponse(res, response ?? new Response('목 핸들러 없음', { status: 501 }));
};

const answerStatic = (res, url) => {
  const file = normalize(join(dist, decodeURIComponent(url.pathname)));
  const target = file.startsWith(dist) && existsSync(file) && statSync(file).isFile() ? file : join(dist, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(target)] ?? 'application/octet-stream' });
  createReadStream(target).pipe(res);
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const work = url.pathname.startsWith('/api/') ? answerApi(req, res, url) : Promise.resolve(answerStatic(res, url));
  work.catch((error) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
}).listen(port, () => console.log(`ready http://localhost:${port} dist=${dist} api=${args.api} delay=${delayMs}ms`));
