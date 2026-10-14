import type { ApiErrorDto } from '@/shared/api/dtos/ApiEnvelopeDto';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';
import {
  capturePostHogException,
  type PostHogErrorCategory,
  type PostHogErrorSeverity,
} from '@/shared/lib/analytics/posthog';

import { clearAuthentication, getAccessToken, getAuthenticationRevision } from '../model/authStore';

type ApiErrorKind = 'network' | 'server' | 'invalid-response' | 'authentication-ended';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly invalidFields: string[];

  constructor({
    kind,
    status = null,
    code = null,
    invalidFields = [],
  }: {
    kind: ApiErrorKind;
    status?: number | null;
    code?: string | null;
    invalidFields?: string[];
  }) {
    super('API 요청을 처리하지 못했습니다.');
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.invalidFields = invalidFields;
  }
}

// DOMException은 실행 환경에 따라 Error의 instanceof 검사에 걸리지 않을 수 있다.
const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

type ApiRequestOptions<T> = {
  config: PublicConfig;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  requiresAuthentication?: boolean;
  parseData: (value: unknown) => T;
};

const captureUnexpectedApiError = ({
  error,
  path,
  method,
  status,
}: {
  error: unknown;
  path: string;
  method: string;
  status?: number;
}) => {
  if (isAbortError(error) || (error instanceof ApiError && error.kind === 'authentication-ended')) return;
  const trackingContext = getApiErrorTrackingContext(error, status);
  const requestPath = path.split(/[?#]/)[0].replace(/\/\d+(?=\/|$)/g, '/:id');
  const responseStatus = status ?? (error instanceof ApiError ? error.status : null);
  const errorCode =
    error instanceof ApiError && error.code !== null && /^[A-Z][A-Z0-9_]{0,99}$/.test(error.code) ? error.code : null;
  // 원문 예외·쿼리·요청 본문에는 위치, 닉네임, 비밀번호 등이 들어갈 수 있다.
  const trackingError = new Error(`${method} ${requestPath}: ${errorCode ?? trackingContext.error_category}`);
  trackingError.name = 'ApiRequestError';
  capturePostHogException(trackingError, {
    source: 'api_request',
    ...trackingContext,
    request_path: requestPath,
    request_method: method,
    ...(responseStatus === null ? {} : { response_status: responseStatus }),
    ...(errorCode === null ? {} : { error_code: errorCode }),
  });
};

export const getApiErrorTrackingContext = (
  error: unknown,
  status?: number,
): { error_category: PostHogErrorCategory; severity: PostHogErrorSeverity } => {
  if (error instanceof ApiError && error.kind === 'network') {
    return { error_category: 'network', severity: 'P2' };
  }

  if (
    (status !== undefined && status >= 500) ||
    (error instanceof ApiError && error.status !== null && error.status >= 500)
  ) {
    return { error_category: 'api_server', severity: 'P1' };
  }

  if (error instanceof ApiError && error.kind === 'server' && error.status !== null && error.status < 500) {
    return { error_category: 'api_client', severity: 'P2' };
  }

  return { error_category: 'api_contract', severity: 'P1' };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isSuccessEnvelope = (value: unknown): value is Record<string, unknown> & { data: unknown } =>
  isRecord(value) &&
  value.code === 'SUCCESS' &&
  typeof value.message === 'string' &&
  Object.prototype.hasOwnProperty.call(value, 'data');

const isErrorDto = (value: unknown): value is ApiErrorDto =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string' && Array.isArray(value.errors);

const getInvalidFields = (value: unknown): string[] => {
  if (!isErrorDto(value)) {
    return [];
  }

  return [
    ...new Set(
      value.errors.flatMap((error) => {
        if (!isRecord(error) || typeof error.field !== 'string' || error.field.length === 0) return [];
        return [error.field];
      }),
    ),
  ];
};

const readJson = async (response: Response): Promise<unknown | undefined> => {
  try {
    const text = await response.text();
    return text.length === 0 ? undefined : JSON.parse(text);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError({ kind: 'invalid-response', status: response.status });
  }
};

export const createApiUrl = (config: PublicConfig, path: string): string => {
  const baseUrl = new URL(config.apiBaseUrl);
  const resolvedUrl = new URL(path, `${baseUrl.origin}/`);

  if (resolvedUrl.origin !== baseUrl.origin) {
    throw new ApiError({ kind: 'invalid-response' });
  }

  return resolvedUrl.toString();
};

type ExecuteRequestOptions = {
  config: PublicConfig;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: Headers;
  body?: BodyInit;
  signal?: AbortSignal;
  requiresAuthentication: boolean;
};

const executeRequest = async ({
  config,
  path,
  method,
  headers,
  body,
  signal,
  requiresAuthentication,
}: ExecuteRequestOptions): Promise<Response> => {
  const authenticationRevision = requiresAuthentication ? getAuthenticationRevision() : null;
  let accessToken: string | null = null;

  if (requiresAuthentication) {
    accessToken = getAccessToken();

    if (accessToken === null) throw new ApiError({ kind: 'authentication-ended' });
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const hasAuthenticationEnded = () =>
    requiresAuthentication &&
    (authenticationRevision !== getAuthenticationRevision() || accessToken !== getAccessToken());

  let response: Response;

  try {
    response = await fetch(createApiUrl(config, path), { method, headers, body, signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (hasAuthenticationEnded()) throw new ApiError({ kind: 'authentication-ended' });

    throw new ApiError({ kind: 'network' });
  }

  if (hasAuthenticationEnded()) throw new ApiError({ kind: 'authentication-ended' });

  if (response.status === 401) {
    clearAuthentication('unauthorized');
  }

  return response;
};

const throwResponseError = async (response: Response): Promise<never> => {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError({ kind: 'invalid-response', status: response.status });
  }

  if (!isErrorDto(payload)) throw new ApiError({ kind: 'invalid-response', status: response.status });

  throw new ApiError({
    kind: 'server',
    status: response.status,
    code: payload.code,
    invalidFields: getInvalidFields(payload),
  });
};

const apiRequestInternal = async <T>({
  config,
  path,
  method = 'GET',
  body,
  formData,
  signal,
  requiresAuthentication = true,
  parseData,
}: ApiRequestOptions<T>): Promise<T> => {
  if (body !== undefined && formData !== undefined) {
    throw new ApiError({ kind: 'invalid-response' });
  }

  const headers = new Headers({ Accept: 'application/json' });

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await executeRequest({
    config,
    path,
    method,
    headers,
    body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    signal,
    requiresAuthentication,
  });

  if (response.status === 204 && response.ok) {
    try {
      return parseData(undefined);
    } catch {
      throw new ApiError({ kind: 'invalid-response', status: response.status });
    }
  }

  if (!response.ok) {
    return throwResponseError(response);
  }

  const payload = await readJson(response);

  if (payload === undefined) {
    try {
      return parseData(undefined);
    } catch {
      throw new ApiError({ kind: 'invalid-response', status: response.status });
    }
  }

  if (!isSuccessEnvelope(payload)) {
    throw new ApiError({ kind: 'invalid-response', status: response.status });
  }

  try {
    return parseData(payload.data);
  } catch {
    throw new ApiError({ kind: 'invalid-response', status: response.status });
  }
};

export const apiRequest = async <T>(options: ApiRequestOptions<T>): Promise<T> => {
  try {
    return await apiRequestInternal(options);
  } catch (error) {
    captureUnexpectedApiError({ error, path: options.path, method: options.method ?? 'GET' });
    throw error;
  }
};

const apiBlobRequestInternal = async ({
  config,
  path,
  method = 'GET',
  body,
  acceptedContentTypes = ['image/jpeg', 'image/png', 'image/webp'],
  signal,
}: {
  config: PublicConfig;
  path: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  acceptedContentTypes?: string[];
  signal?: AbortSignal;
}): Promise<Blob> => {
  const headers = new Headers({ Accept: acceptedContentTypes.join(', ') });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await executeRequest({
    config,
    path,
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    requiresAuthentication: true,
  });

  if (!response.ok) {
    return throwResponseError(response);
  }

  const contentType = response.headers.get('Content-Type')?.split(';')[0]?.trim();

  if (contentType === undefined || !acceptedContentTypes.includes(contentType)) {
    throw new ApiError({ kind: 'invalid-response', status: response.status });
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError({ kind: 'invalid-response', status: response.status });
  }
  return blob.type === contentType ? blob : blob.slice(0, blob.size, contentType);
};

export const apiBlobRequest = async (options: Parameters<typeof apiBlobRequestInternal>[0]): Promise<Blob> => {
  try {
    return await apiBlobRequestInternal(options);
  } catch (error) {
    captureUnexpectedApiError({ error, path: options.path, method: options.method ?? 'GET' });
    throw error;
  }
};

export const getSafeApiErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) {
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (error.kind === 'network') {
    return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  }

  if (error.status === 401) {
    return '인증이 만료되었습니다. 다시 로그인해 주세요.';
  }

  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

export const isApiErrorCode = (error: unknown, code: string): error is ApiError =>
  error instanceof ApiError && error.code === code;
