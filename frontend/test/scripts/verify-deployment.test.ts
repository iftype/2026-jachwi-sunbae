// @vitest-environment node
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const script = resolve(__dirname, '../../deploy/verify-deployment.sh');

const REVALIDATE = 'no-cache,max-age=0,must-revalidate';
const IMMUTABLE = 'public,max-age=31536000,immutable';
const MAIN_JS = 'main.abc123.js';
const BOUNDARY = 'admin-dongs.20250630.abc.geojson';

type Headers = Record<string, string>;
let overrides: Record<string, Headers> = {};
let server: Server;
let baseUrl = '';
let localIndex = '';

const bodies: Record<string, string> = {
  '/index.html': `<script src="/${MAIN_JS}"></script>`,
  '/version.json': '{"version":"1.0.0"}',
  '/boundaries/manifest.json': `{"version":"20250630","file":"${BOUNDARY}"}`,
};

function defaultHeaders(path: string): Headers {
  if (path === `/${MAIN_JS}` || path === `/boundaries/${BOUNDARY}`) return { 'cache-control': IMMUTABLE };
  return { 'cache-control': REVALIDATE };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? '';
    const known = path in bodies || path === `/${MAIN_JS}` || path === `/boundaries/${BOUNDARY}`;
    if (!known) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { ...defaultHeaders(path), ...overrides[path] });
    res.end(bodies[path] ?? 'x');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('서버 주소를 얻지 못했다.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  localIndex = join(mkdtempSync(join(tmpdir(), 'verify-deployment-')), 'index.html');
  writeFileSync(localIndex, bodies['/index.html']);
});

afterAll(() => {
  server.close();
});

async function verify(env: Record<string, string> = {}) {
  try {
    const result = await run(script, [localIndex, `${baseUrl}/index.html`, '1.0.0'], {
      env: { ...process.env, VERIFY_HEADER_RETRIES: '2', VERIFY_HEADER_RETRY_DELAY: '0', ...env },
    });
    return { status: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string };
    return { status: failed.code, stdout: failed.stdout, stderr: failed.stderr };
  }
}

describe('배포 응답 헤더 검증', () => {
  it('기대한 Cache-Control이 모두 맞으면 통과한다', async () => {
    overrides = {};
    const result = await verify();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('배포 응답 헤더를 확인했다.');
  });

  it('해시 JS의 immutable이 빠지면 무엇이 달랐는지 출력하고 실패한다', async () => {
    overrides = { [`/${MAIN_JS}`]: { 'cache-control': 'max-age=0' } };
    const result = await verify();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('main JS');
    expect(result.stderr).toContain(`expected: ${IMMUTABLE}`);
    expect(result.stderr).toContain('actual:   max-age=0');
  });

  it('해시 경계 파일 헤더가 틀려도 실패한다', async () => {
    overrides = { [`/boundaries/${BOUNDARY}`]: { 'cache-control': 'public,max-age=60' } };
    const result = await verify();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('경계 파일');
  });

  it('index.html, version.json, 경계 manifest가 캐시되면 실패한다', async () => {
    overrides = {
      '/index.html': { 'cache-control': IMMUTABLE },
      '/version.json': { 'cache-control': IMMUTABLE },
      '/boundaries/manifest.json': { 'cache-control': IMMUTABLE },
    };
    const result = await verify();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('index.html의 cache-control');
    expect(result.stderr).toContain('version.json의 cache-control');
    expect(result.stderr).toContain('경계 manifest의 cache-control');
  });

  it('brotli 확인은 기본으로 꺼져 있고 환경 변수로 켠다', async () => {
    overrides = { [`/boundaries/${BOUNDARY}`]: { 'content-encoding': 'gzip' } };

    expect((await verify()).status).toBe(0);

    const enabled = await verify({ VERIFY_BOUNDARY_BROTLI: '1' });
    expect(enabled.status).toBe(1);
    expect(enabled.stderr).toContain('expected: br');
    expect(enabled.stderr).toContain('actual:   gzip');

    overrides = { [`/boundaries/${BOUNDARY}`]: { 'content-encoding': 'br' } };
    expect((await verify({ VERIFY_BOUNDARY_BROTLI: '1' })).status).toBe(0);
  });
});
