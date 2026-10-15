// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@/shared/lib/analytics/posthog', () => ({ capturePostHogException: captureException }));

import { apiBlobRequest, apiRequest } from '@/features/auth/api/apiClient';
import { clearAuthentication, setAuthentication } from '@/features/auth/model/authStore';

import { server } from '../../../server';

const config = { apiBaseUrl: 'http://localhost:8080' };
const path = '/api/checklists/42';
const request = (parseData: (value: unknown) => unknown = (value) => value) => apiRequest({ config, path, parseData });

describe('API 오류 수집', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    captureException.mockClear();
    setAuthentication({ accessToken: 'private-token', tokenType: 'Bearer', expiresIn: 60 });
  });

  it.each([400, 401, 403, 404, 409, 429, 500, 503])(
    '%i 오류를 코드와 상태를 포함해 요청당 한 번 수집한다',
    async (status) => {
      server.use(
        http.get(`${config.apiBaseUrl}${path}`, () =>
          HttpResponse.json({ code: 'CHECKLIST_NOT_FOUND', message: 'private message', errors: [] }, { status }),
        ),
      );
      await expect(request()).rejects.toMatchObject({ status, code: 'CHECKLIST_NOT_FOUND' });
      expect(captureException).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          request_path: '/api/checklists/:id',
          response_status: status,
          error_code: 'CHECKLIST_NOT_FOUND',
          severity: status >= 500 ? 'P1' : 'P2',
          error_category: status >= 500 ? 'api_server' : 'api_client',
        }),
      );
    },
  );

  it.each([
    ['성공 envelope 누락', () => HttpResponse.json({ items: [] })],
    ['잘못된 JSON', () => new HttpResponse('{')],
    ['빈 응답', () => new HttpResponse(null)],
  ])('%s도 수집한다', async (_name, response) => {
    server.use(http.get(`${config.apiBaseUrl}${path}`, response));
    await expect(
      request(() => {
        throw new Error('private parser value');
      }),
    ).rejects.toBeDefined();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        response_status: 200,
        severity: 'P1',
        error_category: 'api_contract',
      }),
    );
  });

  it('204 파서 실패에도 상태를 보존한다', async () => {
    server.use(http.get(`${config.apiBaseUrl}${path}`, () => new HttpResponse(null, { status: 204 })));
    await expect(
      request(() => {
        throw new Error('invalid');
      }),
    ).rejects.toMatchObject({ status: 204 });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('쿼리, ID, 서버 메시지와 요청 본문은 수집하지 않는다', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}${path}`, () =>
        HttpResponse.json({ code: 'INVALID_REQUEST', message: 'secret', errors: [] }, { status: 400 }),
      ),
    );
    await expect(
      apiRequest({
        config,
        path: `${path}?password=secret&latitude=37.4`,
        method: 'POST',
        body: { password: 'secret' },
        parseData: (value) => value,
      }),
    ).rejects.toBeDefined();
    const [error, properties] = captureException.mock.calls[0];
    expect(`${String(error)} ${JSON.stringify(properties)}`).not.toMatch(/secret|37\.4|42|password/);
  });

  it('Blob 오류도 빠짐없이 수집한다', async () => {
    server.use(http.get(`${config.apiBaseUrl}${path}`, () => new HttpResponse('not an image')));
    await expect(apiBlobRequest({ config, path })).rejects.toBeDefined();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ severity: 'P1' }));
  });

  it('네트워크 실패를 수집한다', async () => {
    server.use(http.get(`${config.apiBaseUrl}${path}`, () => HttpResponse.error()));
    await expect(request()).rejects.toMatchObject({ kind: 'network' });
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ severity: 'P2', error_category: 'network' }),
    );
  });

  it('사용자 취소와 종료된 인증은 오류로 수집하지 않는다', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      apiRequest({ config, path, signal: controller.signal, parseData: (value) => value }),
    ).rejects.toBeDefined();
    expect(captureException).not.toHaveBeenCalled();
    clearAuthentication('logout');
    await expect(request()).rejects.toMatchObject({ kind: 'authentication-ended' });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('4xx라도 오류 응답 계약을 위반하면 P1로 수집한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}${path}`, () => new HttpResponse('<html>private</html>', { status: 404 })),
    );
    await expect(request()).rejects.toMatchObject({ kind: 'invalid-response', status: 404 });
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ severity: 'P1', error_category: 'api_contract' }),
    );
  });

  it('같은 오류가 재발해도 수집에서 제거하지 않는다', async () => {
    server.use(http.get(`${config.apiBaseUrl}${path}`, () => new HttpResponse(null, { status: 503 })));
    await request().catch(() => undefined);
    await request().catch(() => undefined);
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('정상 응답은 수집하지 않는다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}${path}`, () => HttpResponse.json({ code: 'SUCCESS', message: 'ok', data: [] })),
    );
    await expect(request()).resolves.toEqual([]);
    expect(captureException).not.toHaveBeenCalled();
  });
  it.each([200, 400])('HTTP %i 응답 본문을 읽다가 취소되어도 오류를 수집하지 않는다', async (status) => {
    const response = new Response('{}', { status });
    const abort = new DOMException('cancelled', 'AbortError');
    vi.spyOn(response, status === 200 ? 'text' : 'json').mockRejectedValue(abort);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    await expect(request()).rejects.toMatchObject({ name: 'AbortError' });
    expect(captureException).not.toHaveBeenCalled();
  });
  it('Blob 본문 읽기 실패에도 응답 상태를 보존하여 한 번 수집한다', async () => {
    const response = new Response(null, { headers: { 'Content-Type': 'image/png' } });
    vi.spyOn(response, 'blob').mockRejectedValue(new Error('private body failure'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    await expect(apiBlobRequest({ config, path })).rejects.toMatchObject({ kind: 'invalid-response', status: 200 });
    expect(captureException).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        response_status: 200,
        error_category: 'api_contract',
        severity: 'P1',
      }),
    );
  });
  it('Blob 본문 읽기 취소는 수집하지 않는다', async () => {
    const response = new Response(null, { headers: { 'Content-Type': 'image/png' } });
    vi.spyOn(response, 'blob').mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    await expect(apiBlobRequest({ config, path })).rejects.toMatchObject({ name: 'AbortError' });
    expect(captureException).not.toHaveBeenCalled();
  });
  it('fetch에서 발생한 DOMException 취소도 네트워크 실패로 수집하지 않는다', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    await expect(request()).rejects.toMatchObject({ name: 'AbortError' });
    expect(captureException).not.toHaveBeenCalled();
  });
});
