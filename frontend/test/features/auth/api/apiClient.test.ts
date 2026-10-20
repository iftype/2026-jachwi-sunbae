// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest, getApiErrorTrackingContext } from '@/features/auth/api/apiClient';
import { clearAuthentication, getAccessToken, setAuthentication } from '@/features/auth/model/authStore';
import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import { queryClient } from '@/shared/api/queryClient';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
};

describe('API 클라이언트', () => {
  it('API 오류를 대응 우선순위와 종류로 분류한다', () => {
    expect(getApiErrorTrackingContext(new ApiError({ kind: 'network' }))).toEqual({
      error_category: 'network',
      severity: 'P2',
    });
    expect(getApiErrorTrackingContext(new Error('서버 오류'), 503)).toEqual({
      error_category: 'api_server',
      severity: 'P1',
    });
    expect(getApiErrorTrackingContext(new ApiError({ kind: 'invalid-response' }))).toEqual({
      error_category: 'api_contract',
      severity: 'P1',
    });
  });

  it('204 No Content 응답을 JSON 파싱 없이 처리할 수 있다', async () => {
    setAuthentication({ accessToken: 'member-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(http.delete(`${config.apiBaseUrl}/api/example`, () => new HttpResponse(null, { status: 204 })));

    const result = await apiRequest({
      config,
      path: '/api/example',
      method: 'DELETE',
      parseData: (value) => {
        expect(value).toBeUndefined();
        return undefined;
      },
    });

    expect(result).toBeUndefined();
  });

  it('성공 응답은 SUCCESS·message·data envelope를 모두 만족해야 한다', async () => {
    setAuthentication({ accessToken: 'member-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(
      http.get(`${config.apiBaseUrl}/api/example`, () =>
        HttpResponse.json({ code: 'OTHER', message: '형식은 비슷하지만 성공 envelope가 아님', data: {} }),
      ),
    );

    await expect(apiRequest({ config, path: '/api/example', parseData: (value) => value })).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('401은 서버 message를 노출하지 않고 인증과 Query Cache를 정리하며 오류 code를 보존한다', async () => {
    setAuthentication({ accessToken: 'member-token', tokenType: 'Bearer', expiresIn: 60 });
    queryClient.setQueryData(propertyQueryKeys.detail(10), { memo: '다음 회원에게 남으면 안 됨' });
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json({ code: 'ACCESS_TOKEN_EXPIRED', message: '내부 인증 상세', errors: [] }, { status: 401 }),
      ),
    );

    const error = await apiRequest({ config, path: '/api/properties/10', parseData: (value) => value }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toMatchObject({ status: 401, code: 'ACCESS_TOKEN_EXPIRED' });
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(propertyQueryKeys.detail(10))).toBeUndefined();
    expect(String(error)).not.toContain('내부 인증 상세');
  });

  it('오류 envelope의 잘못된 errors 항목도 원문 예외로 노출하지 않고 code를 보존한다', async () => {
    setAuthentication({ accessToken: 'member-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(
      http.get(`${config.apiBaseUrl}/api/example`, () =>
        HttpResponse.json(
          { code: 'CHECKLIST_ITEM_NOT_FOUND', message: '내부 상세', errors: [null, { field: 'items' }] },
          { status: 400 },
        ),
      ),
    );

    await expect(apiRequest({ config, path: '/api/example', parseData: (value) => value })).rejects.toMatchObject({
      kind: 'server',
      status: 400,
      code: 'CHECKLIST_ITEM_NOT_FOUND',
      invalidFields: ['items'],
    });
  });

  it('인증이 끝난 뒤 도착한 보호 API 응답은 파싱하거나 캐시에 반영할 수 없게 폐기한다', async () => {
    setAuthentication({ accessToken: 'member-a-token', tokenType: 'Bearer', expiresIn: 60 });
    let releaseResponse: (() => void) | undefined;
    let markResponseStarted: (() => void) | undefined;
    const responseStarted = new Promise<void>((resolve) => {
      markResponseStarted = resolve;
    });
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    server.use(
      http.put(`${config.apiBaseUrl}/api/properties/10/memo`, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer member-a-token');
        markResponseStarted?.();
        await responseGate;
        return HttpResponse.json({
          code: 'SUCCESS',
          message: '요청에 성공했습니다.',
          data: { content: '다른 회원에게 남으면 안 되는 메모', savedAt: '2026-08-11T07:00:00Z' },
        });
      }),
    );
    const parseData = vi.fn((value: unknown) => value);

    const request = apiRequest({
      config,
      path: '/api/properties/10/memo',
      method: 'PUT',
      body: { content: '다른 회원에게 남으면 안 되는 메모' },
      parseData,
    });
    await responseStarted;
    clearAuthentication('logout');
    releaseResponse?.();

    await expect(request).rejects.toMatchObject({ kind: 'authentication-ended' });
    expect(parseData).not.toHaveBeenCalled();
  });

  it('이전 인증 요청의 늦은 401이 새 인증을 종료하지 못하게 한다', async () => {
    setAuthentication({ accessToken: 'member-a-token', tokenType: 'Bearer', expiresIn: 60 });
    let releaseResponse: (() => void) | undefined;
    let markResponseStarted: (() => void) | undefined;
    const responseStarted = new Promise<void>((resolve) => {
      markResponseStarted = resolve;
    });
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    server.use(
      http.get(`${config.apiBaseUrl}/api/members/me`, async () => {
        markResponseStarted?.();
        await responseGate;
        return HttpResponse.json({ code: 'ACCESS_TOKEN_EXPIRED', message: '만료', errors: [] }, { status: 401 });
      }),
    );

    const request = apiRequest({
      config,
      path: '/api/members/me',
      parseData: (value) => value,
    });
    await responseStarted;
    setAuthentication({ accessToken: 'member-b-token', tokenType: 'Bearer', expiresIn: 60 });
    releaseResponse?.();

    await expect(request).rejects.toMatchObject({ kind: 'authentication-ended' });
    expect(getAccessToken()).toBe('member-b-token');
  });

  it('인증 종료 뒤 발생한 네트워크 실패를 재시도 가능한 요청 실패로 해석하지 않는다', async () => {
    setAuthentication({ accessToken: 'member-token', tokenType: 'Bearer', expiresIn: 60 });
    let releaseResponse: (() => void) | undefined;
    let markResponseStarted: (() => void) | undefined;
    const responseStarted = new Promise<void>((resolve) => {
      markResponseStarted = resolve;
    });
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    server.use(
      http.patch(`${config.apiBaseUrl}/api/properties/10/checklists/20/items/501/status`, async () => {
        markResponseStarted?.();
        await responseGate;
        return HttpResponse.error();
      }),
    );

    const request = apiRequest({
      config,
      path: '/api/properties/10/checklists/20/items/501/status',
      method: 'PATCH',
      body: { status: 'GOOD', expectedVersion: 0 },
      parseData: (value) => value,
    });
    await responseStarted;
    clearAuthentication('logout');
    releaseResponse?.();

    await expect(request).rejects.toMatchObject({ kind: 'authentication-ended' });
  });
});
