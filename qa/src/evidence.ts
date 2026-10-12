import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page, Response } from '@playwright/test';

import type { ApiCall, WatchedRequest } from './api';

// qa/docs/report-schema.md 3. Evidence: 항상 수집, Scenario 지정, 실패 시 추가 수집의 세 계층으로 모은다.
// Run마다 `qa/runs/{Run ID}/evidence/`에 파일로 남기고, 인증 정보는 가린다.

export const RUNS_DIR = resolve(__dirname, '../runs');

export type EvidenceKind = '스크린샷' | 'API' | '콘솔' | '네트워크' | '기록' | '트레이스';

export type EvidenceRecord = {
  id: string;
  kind: EvidenceKind;
  /** Run 디렉터리 기준 경로 */
  file: string;
  description: string;
};

type ConsoleEntry = { at: number; type: string; text: string; location: string };
type NetworkEntry = {
  at: number;
  method: string;
  url: string;
  status: number | null;
  requestId: string | null;
  failure?: string;
};

const SECRET_KEY = /token|password|authorization|cookie/i;
// fixtures.ts에서 차단한 분석 요청과 그로 인한 콘솔 오류는 제품 문제가 아니므로 기록에서 제외한다.
const IGNORED_URL = /posthog\.com/;

/** JSON 안의 토큰, 비밀번호 같은 값을 가린다. */
const maskSecrets = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? '***' : maskSecrets(item)]),
    );
  }
  return value;
};

const parseBody = (text: string | null): unknown => {
  if (text === null || text.length === 0) return null;
  try {
    return maskSecrets(JSON.parse(text));
  } catch {
    return text;
  }
};

export class EvidenceCollector {
  readonly records: EvidenceRecord[] = [];
  private readonly consoleEntries: ConsoleEntry[] = [];
  private readonly networkEntries: NetworkEntry[] = [];
  private readonly startedAt = Date.now();
  private extraCount = 0;

  constructor(
    readonly runDir: string,
    private readonly page: Page,
  ) {
    mkdirSync(resolve(runDir, 'evidence'), { recursive: true });

    page.on('console', (message) => {
      const location = message.location().url;
      if (IGNORED_URL.test(location)) return;
      this.consoleEntries.push({ at: this.elapsed(), type: message.type(), text: message.text(), location });
    });
    page.on('pageerror', (error) => {
      this.consoleEntries.push({ at: this.elapsed(), type: 'pageerror', text: error.message, location: this.page.url() });
    });
    page.on('response', (response) => {
      const request = response.request();
      const isApi = new URL(response.url()).pathname.startsWith('/api/');
      if (!isApi && request.resourceType() !== 'document' && response.status() < 400) return;
      this.networkEntries.push({
        at: this.elapsed(),
        method: request.method(),
        url: response.url(),
        status: response.status(),
        requestId: response.headers()['x-request-id'] ?? null,
      });
    });
    page.on('requestfailed', (request) => {
      if (IGNORED_URL.test(request.url())) return;
      this.networkEntries.push({
        at: this.elapsed(),
        method: request.method(),
        url: request.url(),
        status: null,
        requestId: null,
        failure: request.failure()?.errorText ?? 'unknown',
      });
    });
  }

  /** Scenario의 Required Evidence로 현재 화면 전체를 저장한다. */
  async screen(id: string, description: string): Promise<void> {
    const file = this.reserve(`${id}-screen`, 'png');
    await this.page.screenshot({ path: resolve(this.runDir, file), fullPage: true });
    this.records.push({ id, kind: '스크린샷', file, description: `${description} (${new URL(this.page.url()).pathname})` });
  }

  /** Scenario의 Required Evidence로 감시한 요청 기록을 저장한다. 요청이 없었으면 0건으로 남는다. */
  requests(id: string, label: string, requests: WatchedRequest[], description: string): void {
    const file = this.reserve(`${id}-requests`, 'json');
    const masked = requests.map((request) => ({ ...request, body: parseBody(request.body) }));
    writeFileSync(
      resolve(this.runDir, file),
      JSON.stringify({ watched: label, count: requests.length, requests: masked }, null, 2),
    );
    this.records.push({ id, kind: '네트워크', file, description: `${description}: ${label} ${requests.length}건` });
  }

  /** Scenario의 Required Evidence로 브라우저 안에서 모은 기록을 저장한다. 기록이 없었으면 0건으로 남는다. */
  log(id: string, name: string, entries: unknown[], description: string): void {
    const file = this.reserve(`${id}-${name}`, 'json');
    writeFileSync(resolve(this.runDir, file), JSON.stringify({ count: entries.length, entries }, null, 2));
    this.records.push({ id, kind: '기록', file, description: `${description}: ${entries.length}건` });
  }

  /** Scenario의 Required Evidence로 직접 호출한 API 요청과 응답을 저장한다. 인증 토큰은 남기지 않는다. */
  apiCall(id: string, call: ApiCall, description: string): void {
    const content = {
      request: {
        method: call.method,
        url: call.url,
        authorization: call.authenticated ? 'Bearer ***' : null,
        body: maskSecrets(call.requestBody),
      },
      response: { status: call.status, requestId: call.requestId, body: parseBody(call.responseText) },
    };
    const file = this.reserve(`${id}-api`, 'json');
    writeFileSync(resolve(this.runDir, file), JSON.stringify(content, null, 2));
    const requestId = call.requestId === null ? '' : `, 요청 ID ${call.requestId}`;
    this.records.push({
      id,
      kind: 'API',
      file,
      description: `${description}: ${call.method} ${new URL(call.url).pathname} ${call.status}${call.authenticated ? '' : ', 인증 없음'}${requestId}`,
    });
  }

  /** Scenario의 Required Evidence로 API 요청과 응답을 저장한다. */
  async api(id: string, response: Response, description: string): Promise<void> {
    const request = response.request();
    const responseText = await response.text().catch(() => null);
    const content = {
      request: {
        method: request.method(),
        url: request.url(),
        body: parseBody(request.postData()),
      },
      response: {
        status: response.status(),
        requestId: response.headers()['x-request-id'] ?? null,
        body: parseBody(responseText),
      },
    };
    const file = this.reserve(`${id}-api`, 'json');
    writeFileSync(resolve(this.runDir, file), JSON.stringify(content, null, 2));
    const requestId = content.response.requestId === null ? '' : `, 요청 ID ${content.response.requestId}`;
    this.records.push({
      id,
      kind: 'API',
      file,
      description: `${description}: ${request.method()} ${new URL(request.url()).pathname} ${response.status()}${requestId}`,
    });
  }

  /** 항상 수집: 실행이 끝난 시점의 화면. 단계가 멈췄다면 멈춘 시점의 화면이다. */
  async finalScreen(): Promise<void> {
    const id = this.nextExtraId();
    const file = this.reserve(`${id}-final-screen`, 'png');
    const saved = await this.page
      .screenshot({ path: resolve(this.runDir, file), fullPage: true })
      .then(() => true)
      .catch(() => false);
    if (saved) {
      this.records.push({ id, kind: '스크린샷', file, description: `실행 종료 시점 화면 (${new URL(this.page.url()).pathname})` });
    }
  }

  /** 실패 시 추가 수집: 브라우저 콘솔과 네트워크 기록. */
  writeDiagnostics(): void {
    const consoleId = this.nextExtraId();
    const consoleFile = this.reserve(`${consoleId}-console`, 'json');
    writeFileSync(resolve(this.runDir, consoleFile), JSON.stringify(this.consoleEntries, null, 2));
    const errorCount = this.consoleEntries.filter((entry) => entry.type === 'error' || entry.type === 'pageerror').length;
    this.records.push({
      id: consoleId,
      kind: '콘솔',
      file: consoleFile,
      description: `브라우저 콘솔 ${this.consoleEntries.length}건, 오류 ${errorCount}건`,
    });

    const networkId = this.nextExtraId();
    const networkFile = this.reserve(`${networkId}-network`, 'json');
    writeFileSync(resolve(this.runDir, networkFile), JSON.stringify(this.networkEntries, null, 2));
    const failedCount = this.networkEntries.filter((entry) => entry.status === null || entry.status >= 400).length;
    this.records.push({
      id: networkId,
      kind: '네트워크',
      file: networkFile,
      description: `API·문서 요청과 실패 요청 ${this.networkEntries.length}건, 실패 ${failedCount}건`,
    });
  }

  private nextExtraId(): string {
    this.extraCount += 1;
    return `EV+${this.extraCount}`;
  }

  /** 같은 이름의 파일이 있으면 번호를 붙여 겹치지 않는 경로를 만든다. */
  private reserve(name: string, extension: string): string {
    let file = `evidence/${name}.${extension}`;
    for (let index = 2; existsSync(resolve(this.runDir, file)); index += 1) {
      file = `evidence/${name}-${index}.${extension}`;
    }
    return file;
  }

  private elapsed(): number {
    return Date.now() - this.startedAt;
  }
}
