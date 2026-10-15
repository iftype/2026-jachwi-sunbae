import type { APIRequestContext, Page, Request, Response } from '@playwright/test';

/** `page.waitForResponse`에 넘길 API 응답 조건. 경로는 쿼리를 제외하고 정확히 비교한다. */
export const isApiResponse =
  (method: string, pathname: string) =>
  (response: Response): boolean =>
    response.request().method() === method && new URL(response.url()).pathname === pathname;

/** 응답 본문을 JSON으로 읽는다. 본문이 없거나 JSON이 아니면 null이다. */
export const readJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export type WatchedRequest = {
  method: string;
  url: string;
  /** 응답을 받지 못했으면 null이다. */
  status: number | null;
  requestId: string | null;
  /** 요청 본문. 없으면 null이다. */
  body: string | null;
};

export type RequestWatch = {
  /** 감시 대상 요청. 예: `POST /api/properties` */
  label: string;
  /** 감시를 멈추고 그동안 보낸 요청을 돌려준다. 요청이 없으면 빈 배열이다. */
  stop: () => Promise<WatchedRequest[]>;
};

/**
 * 지정한 요청을 감시한다. 요청이 "없었음"을 확인할 때도 쓴다.
 * 경로에 ID가 섞여 정확히 비교할 수 없으면 정규식과 함께 읽을 수 있는 경로 이름을 넘긴다.
 */
export const watchRequests = (
  page: Page,
  method: string,
  pathname: string | RegExp,
  pathLabel: string = String(pathname),
): RequestWatch => {
  const matches = (requestPath: string): boolean =>
    typeof pathname === 'string' ? requestPath === pathname : pathname.test(requestPath);
  const requests: Request[] = [];
  const onRequest = (request: Request): void => {
    if (request.method() === method && matches(new URL(request.url()).pathname)) requests.push(request);
  };
  page.on('request', onRequest);

  return {
    label: `${method} ${pathLabel}`,
    stop: async () => {
      page.off('request', onRequest);
      return Promise.all(
        requests.map(async (request) => {
          const response = await request.response().catch(() => null);
          return {
            method: request.method(),
            url: request.url(),
            status: response?.status() ?? null,
            requestId: response?.headers()['x-request-id'] ?? null,
            body: request.postData(),
          };
        }),
      );
    },
  };
};

/** 화면을 거치지 않고 보낸 API 요청과 응답. 인증 토큰 값은 담지 않는다. */
export type ApiCall = {
  method: string;
  url: string;
  /** 인증 헤더를 붙였는지 */
  authenticated: boolean;
  requestBody: unknown;
  status: number;
  requestId: string | null;
  responseText: string;
};

/**
 * API를 직접 호출한다. 화면에서 할 수 없는 시도(다른 회원의 자원 접근 등)를 할 때 쓴다.
 * 상태 코드와 관계없이 응답을 돌려준다.
 */
export const callApi = async (
  request: APIRequestContext,
  method: string,
  url: string,
  options: { token?: string; body?: unknown } = {},
): Promise<ApiCall> => {
  const response = await request.fetch(url, {
    method,
    headers: options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` },
    data: options.body,
    failOnStatusCode: false,
  });
  return {
    method,
    url,
    authenticated: options.token !== undefined,
    requestBody: options.body ?? null,
    status: response.status(),
    requestId: response.headers()['x-request-id'] ?? null,
    responseText: await response.text().catch(() => ''),
  };
};

/** 직접 호출한 응답의 본문을 JSON으로 읽는다. 본문이 없거나 JSON이 아니면 null이다. */
export const parseApiCall = <T>(call: ApiCall): T | null => {
  try {
    return JSON.parse(call.responseText) as T;
  } catch {
    return null;
  }
};
