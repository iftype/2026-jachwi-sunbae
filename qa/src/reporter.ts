import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

import { analyzeRun, type AnalysisRecord } from './ai-analysis';
import { writeReport } from './report';
import type { ScenarioResult } from './scenario-run';
import { writeBatchSummary } from './summary';

// 테스트가 끝난 뒤 Run 디렉터리를 마무리한다.
// trace는 테스트가 끝난 뒤에 만들어지므로 테스트 안이 아니라 리포터에서 Run 디렉터리로 옮긴다.
// 모든 테스트가 끝나면 AI 분석을 실행하고 Run Report(report.md)를 만든다. Scenario를 여러 개 실행했으면 일괄 실행 요약도 만든다.
// QA_AI_ANALYSIS: failed(기본, PASS가 아닌 Run만), always, off

const REPOSITORY_ROOT = resolve(__dirname, '../..');

const readScenarioResult = (result: TestResult): ScenarioResult | null => {
  const attachment = result.attachments.find((item) => item.name === 'scenario-result.json');
  return attachment?.body === undefined ? null : (JSON.parse(attachment.body.toString('utf-8')) as ScenarioResult);
};

/** 실패한 Run에 Playwright trace를 실패 시 추가 Evidence로 붙인다. */
const attachTrace = (scenarioResult: ScenarioResult, result: TestResult): void => {
  const trace = result.attachments.find((item) => item.name === 'trace' && item.path !== undefined);
  if (trace?.path === undefined || !existsSync(trace.path)) return;

  const runDir = resolve(REPOSITORY_ROOT, scenarioResult.runDir);
  const resultFile = resolve(runDir, 'result.json');
  const saved = JSON.parse(readFileSync(resultFile, 'utf-8')) as ScenarioResult;
  const id = `EV+${saved.evidence.filter((record) => record.id.startsWith('EV+')).length + 1}`;
  const file = `evidence/${id}-trace.zip`;

  copyFileSync(trace.path, resolve(runDir, file));
  saved.evidence.push({ id, kind: '트레이스', file, description: 'Playwright trace (npx playwright show-trace로 열기)' });
  writeFileSync(resultFile, JSON.stringify(saved, null, 2));
};

const AI_ANALYSIS_MODES = ['failed', 'always', 'off'] as const;
type AiAnalysisMode = (typeof AI_ANALYSIS_MODES)[number];

const aiAnalysisMode = (): AiAnalysisMode => {
  const mode = process.env.QA_AI_ANALYSIS?.trim() || 'failed';
  if (!(AI_ANALYSIS_MODES as readonly string[]).includes(mode)) {
    throw new Error(`알 수 없는 QA_AI_ANALYSIS '${mode}'. 사용 가능: ${AI_ANALYSIS_MODES.join(', ')}`);
  }
  return mode as AiAnalysisMode;
};

const describeAnalysis = (record: AnalysisRecord): string => {
  if (record.analysis === null) return `AI 분석 실패: ${record.error}`;
  const { proposedSeverity, confidence, suggestedHumanVerdict } = record.analysis;
  const seconds = Math.round(record.durationMs / 1000);
  return `AI 분석 완료(${seconds}초): 판정 제안 ${suggestedHumanVerdict.value}, 제안 심각도 ${proposedSeverity.level}, 확신도 ${confidence}`;
};

class QaRunReporter implements Reporter {
  private readonly runs: ScenarioResult[] = [];
  private startedAt = new Date();

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startedAt = new Date();
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    const scenarioResult = readScenarioResult(result);
    if (scenarioResult === null) return;
    if (scenarioResult.verdict !== 'PASS') {
      attachTrace(scenarioResult, result);
    }
    this.runs.push(scenarioResult);
  }

  async onEnd(): Promise<void> {
    if (this.runs.length === 0) return;
    const mode = aiAnalysisMode();

    console.log('\nQA Run');
    for (const run of this.runs) {
      console.log(`  ${run.verdict.padEnd(12)} ${run.runName}`);
      const runDir = resolve(REPOSITORY_ROOT, run.runDir);
      if (mode === 'always' || (mode === 'failed' && run.verdict !== 'PASS')) {
        console.log('    AI 분석 중...');
        console.log(`    ${describeAnalysis(await analyzeRun(runDir))}`);
      }
      console.log(`    Run Report: ${relative(REPOSITORY_ROOT, writeReport(runDir))}`);
    }

    if (this.runs.length > 1) {
      const { path, changedCount } = writeBatchSummary(this.runs, this.startedAt);
      const change = changedCount === null ? '비교할 직전 일괄 실행 없음' : `직전 대비 판정이 바뀐 Scenario ${changedCount}개`;
      console.log(`\n일괄 실행 요약: ${relative(REPOSITORY_ROOT, path)} (${change})`);
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}

export default QaRunReporter;
