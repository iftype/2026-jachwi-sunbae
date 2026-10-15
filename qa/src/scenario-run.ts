import { writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { Locator, Page, Response, TestInfo } from '@playwright/test';

import type { ApiCall, RequestWatch, WatchedRequest } from './api';
import { qaConfig } from './config';
import { EvidenceCollector, type EvidenceRecord, RUNS_DIR } from './evidence';
import { type ActiveFault, activeFault } from './faults';
import type { QaMember } from './member';
import { loadScenario, type ScenarioDoc } from './scenario-doc';

// Expected별 판정(PASS, FAIL, NEEDS_REVIEW, BLOCKED)과 실제 결과 문장, 소요 시간을 JSON으로 남긴다.
// 승인이나 자동화 상태가 아닌 Scenario는 실행을 거부한다.
/** qa/docs/report-schema.md 4.1 Expected 판정값 */
export type Verdict = 'PASS' | 'FAIL' | 'NEEDS_REVIEW' | 'BLOCKED';

export type ExpectedOutcome = {
  verdict: Exclude<Verdict, 'BLOCKED'>;
  actual: string;
};

export const pass = (actual: string): ExpectedOutcome => ({ verdict: 'PASS', actual });
export const fail = (actual: string): ExpectedOutcome => ({ verdict: 'FAIL', actual });
/** 코드로 판정할 수 없어 AI나 사람의 해석이 필요하다. */
export const needsReview = (actual: string): ExpectedOutcome => ({ verdict: 'NEEDS_REVIEW', actual });

export type ExpectedResult = {
  id: string;
  expected: string;
  basis: string;
  verdict: Verdict;
  judgedBy: '코드';
  actual: string;
  /** 이 Expected의 근거로 수집한 Evidence ID */
  evidence: string[];
};

export type ScenarioResult = {
  runName: string;
  runId: string;
  scenario: { id: string; title: string; status: string; path: string };
  environment: {
    baseUrl: string;
    apiOrigin: string;
    /** DEV 백엔드의 `/actuator/info`. 조회하지 못하면 null이다. */
    backendBuild: { version: string; commit: string } | null;
  };
  member: { nickname: string; memberId: number };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  verdict: Verdict;
  expected: ExpectedResult[];
  /** 저장소 루트 기준 Run 디렉터리 */
  runDir: string;
  evidence: EvidenceRecord[];
  /** Scenario가 요구했지만 수집하지 못한 Evidence ID */
  missingEvidence: string[];
  /** 의도적으로 주입한 결함. AI 분석에는 전달하지 않는다. */
  faultInjection: ActiveFault | null;
};

// qa/docs/report-schema.md 4.2: 사람이 먼저 봐야 할 결과를 앞에 둔다.
const VERDICT_PRIORITY: Verdict[] = ['FAIL', 'NEEDS_REVIEW', 'BLOCKED', 'PASS'];
const RUNNABLE_STATUSES = new Set(['승인', '자동화']);

const REPOSITORY_ROOT = resolve(__dirname, '../..');

const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0].replace(/\u001b\[[0-9;]*m/g, '');

/** Scenario 한 번의 실행(Run)에서 Expected별 판정을 기록한다. */
export class ScenarioRun {
  private readonly results = new Map<string, ExpectedResult>();

  private readonly evidence: EvidenceCollector;
  private backendBuild: ScenarioResult['environment']['backendBuild'] = null;

  private constructor(
    readonly scenario: ScenarioDoc,
    private readonly member: QaMember,
    private readonly page: Page,
    private readonly testInfo: TestInfo,
  ) {
    this.evidence = new EvidenceCollector(resolve(RUNS_DIR, this.runName), page);
  }

  static start(scenarioId: string, member: QaMember, page: Page, testInfo: TestInfo): ScenarioRun {
    const scenario = loadScenario(scenarioId);
    // qa/docs/scenarios/README.md: 자동화는 승인된 Scenario만 한다.
    if (!RUNNABLE_STATUSES.has(scenario.status)) {
      throw new Error(`${scenarioId}의 상태가 '${scenario.status}'입니다. 승인된 Scenario만 실행합니다.`);
    }
    return new ScenarioRun(scenario, member, page, testInfo);
  }

  get runName(): string {
    return `${this.scenario.id}-${this.member.runId}`;
  }

  /**
   * Scenario의 Required Evidence로 현재 화면을 저장한다. 설명은 Scenario 문서에서 가져온다.
   * 확인 대상이 안쪽 스크롤 영역에 있으면 전체 페이지 스크린샷에 찍히지 않으므로 focus로 그 요소까지 스크롤한다.
   */
  async captureScreen(evidenceId: string, focus?: Locator): Promise<void> {
    if (focus !== undefined) await focus.scrollIntoViewIfNeeded().catch(() => undefined);
    await this.evidence.screen(evidenceId, this.requiredEvidence(evidenceId).text);
  }

  /** Scenario의 Required Evidence로 API 요청과 응답을 저장한다. 설명은 Scenario 문서에서 가져온다. */
  async captureApi(evidenceId: string, response: Response): Promise<void> {
    await this.evidence.api(evidenceId, response, this.requiredEvidence(evidenceId).text);
  }

  /** Scenario의 Required Evidence로 감시한 요청 기록을 저장한다. 요청이 "없었음"도 Evidence로 남는다. */
  async captureRequests(evidenceId: string, watch: RequestWatch): Promise<WatchedRequest[]> {
    const requests = await watch.stop();
    this.evidence.requests(evidenceId, watch.label, requests, this.requiredEvidence(evidenceId).text);
    return requests;
  }

  /** Scenario의 Required Evidence로 직접 호출한 API 요청과 응답을 저장한다. 설명은 Scenario 문서에서 가져온다. */
  captureApiCall(evidenceId: string, call: ApiCall): void {
    this.evidence.apiCall(evidenceId, call, this.requiredEvidence(evidenceId).text);
  }

  /** Scenario의 Required Evidence로 브라우저 안에서 모은 기록(예: 위치 권한 요청 호출)을 저장한다. */
  captureLog(evidenceId: string, name: string, entries: unknown[]): void {
    this.evidence.log(evidenceId, name, entries, this.requiredEvidence(evidenceId).text);
  }

  /** Expected 하나를 판정한다. 판정 중 예외가 나면 실패로 기록한다. */
  async check(expectedId: string, judge: () => Promise<ExpectedOutcome>): Promise<void> {
    const definition = this.scenario.expected.find((expected) => expected.id === expectedId);
    if (definition === undefined) {
      throw new Error(`${expectedId}가 ${this.scenario.path}의 Expected에 없습니다.`);
    }

    let outcome: ExpectedOutcome;
    try {
      outcome = await judge();
    } catch (error) {
      outcome = fail(`확인 중 오류: ${firstLine(error)}`);
    }
    this.results.set(expectedId, {
      id: expectedId,
      expected: definition.text,
      basis: definition.basis,
      verdict: outcome.verdict,
      judgedBy: '코드',
      actual: outcome.actual,
      evidence: [],
    });
  }

  /**
   * Scenario 단계를 실행하고 결과를 남긴다.
   * 단계가 중간에 멈추면 확인하지 못한 Expected는 BLOCKED다. 최종 판정이 PASS가 아니면 테스트를 실패시킨다.
   */
  async execute(steps: () => Promise<void>): Promise<ScenarioResult> {
    let stepError: unknown = null;
    try {
      await steps();
    } catch (error) {
      stepError = error;
    }

    for (const definition of this.scenario.expected) {
      if (this.results.has(definition.id)) continue;
      this.results.set(definition.id, {
        id: definition.id,
        expected: definition.text,
        basis: definition.basis,
        verdict: 'BLOCKED',
        judgedBy: '코드',
        actual:
          stepError === null
            ? '이 Expected를 확인하는 코드가 실행되지 않았다.'
            : `단계 실행이 멈춰 확인하지 못했다: ${firstLine(stepError)}`,
        evidence: [],
      });
    }

    await this.evidence.finalScreen();
    this.backendBuild = await this.fetchBackendBuild();
    let result = this.toResult();
    if (result.verdict !== 'PASS') {
      this.evidence.writeDiagnostics();
      result = { ...result, evidence: [...this.evidence.records] };
    }
    writeFileSync(resolve(this.evidence.runDir, 'result.json'), JSON.stringify(result, null, 2));
    await this.testInfo.attach('scenario-result.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });

    if (result.verdict !== 'PASS') {
      const lines = result.expected
        .filter((expected) => expected.verdict !== 'PASS')
        .map((expected) => `- ${expected.id} ${expected.verdict}: ${expected.actual}`);
      throw new Error(`${this.runName} ${result.verdict}\n${lines.join('\n')}`, { cause: stepError ?? undefined });
    }
    return result;
  }

  private toResult(): ScenarioResult {
    const collectedIds = new Set(this.evidence.records.map((record) => record.id));
    const expected = this.scenario.expected.map((definition) => ({
      ...this.results.get(definition.id)!,
      evidence: this.scenario.requiredEvidence
        .filter((evidence) => evidence.targets.includes(definition.id) && collectedIds.has(evidence.id))
        .map((evidence) => evidence.id),
    }));
    const verdict = VERDICT_PRIORITY.find((candidate) => expected.some((item) => item.verdict === candidate)) ?? 'PASS';
    const finishedAt = new Date();

    return {
      runName: this.runName,
      runId: this.member.runId,
      scenario: {
        id: this.scenario.id,
        title: this.scenario.title,
        status: this.scenario.status,
        path: this.scenario.path,
      },
      environment: { baseUrl: qaConfig.baseUrl, apiOrigin: this.member.apiOrigin, backendBuild: this.backendBuild },
      member: { nickname: this.member.nickname, memberId: this.member.memberId },
      startedAt: this.member.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - this.member.startedAt.getTime(),
      verdict,
      expected,
      runDir: relative(REPOSITORY_ROOT, this.evidence.runDir),
      evidence: [...this.evidence.records],
      missingEvidence: this.scenario.requiredEvidence
        .map((evidence) => evidence.id)
        .filter((evidenceId) => !collectedIds.has(evidenceId)),
      faultInjection: activeFault(),
    };
  }

  /** 실행 대상 백엔드의 빌드 버전과 커밋. Run Report의 대상 버전으로 쓴다. */
  private async fetchBackendBuild(): Promise<ScenarioResult['environment']['backendBuild']> {
    try {
      const response = await this.page.request.get(`${this.member.apiOrigin}/actuator/info`, { timeout: 5_000 });
      const body = (await response.json()) as { build?: { version?: string; commit?: string } };
      const { version, commit } = body.build ?? {};
      return version && commit ? { version, commit } : null;
    } catch {
      return null;
    }
  }

  private requiredEvidence(evidenceId: string): ScenarioDoc['requiredEvidence'][number] {
    const evidence = this.scenario.requiredEvidence.find((item) => item.id === evidenceId);
    if (evidence === undefined) {
      throw new Error(`${evidenceId}가 ${this.scenario.path}의 Required Evidence에 없습니다.`);
    }
    return evidence;
  }
}
