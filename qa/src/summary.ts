import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AnalysisRecord } from './ai-analysis';
import { RUNS_DIR } from './evidence';
import { environmentLabel, kst, table } from './report';
import { formatRunId } from './run-id';
import { listScenarios } from './scenario-doc';
import type { ScenarioResult, Verdict } from './scenario-run';

// 여러 Scenario를 한 번에 실행하면 Run별 Run Report와 함께 전체 요약(runs/summary-{일괄 실행 ID}.md)을 만든다.
// 직전 일괄 실행과 비교해 판정이 바뀐 Scenario를 따로 보여준다. 같은 실패를 매번 다시 보지 않고 바뀐 것부터 본다.

const REPOSITORY_ROOT = resolve(__dirname, '../..');
const SPEC_DIR = resolve(REPOSITORY_ROOT, 'docs/product/specs');
const SUMMARY_FILE = /^summary-(\d{6}-\d{6})\.json$/;
const AC_ID = /AC-[A-Z]+-\d{3}/g;

type SummaryRun = {
  scenarioId: string;
  title: string;
  runName: string;
  verdict: Verdict;
  durationMs: number;
  /** AI 판정 제안과 심각도. 분석하지 않았으면 null이다. */
  aiSuggestion: string | null;
  aiCostUsd: number | null;
};

type BatchSummary = {
  batchId: string;
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  backendBuild: ScenarioResult['environment']['backendBuild'];
  /** 의도적으로 주입한 결함 이름. 주입한 일괄 실행은 다음 실행의 비교 기준으로 쓰지 않는다. */
  faultInjection: string | null;
  runs: SummaryRun[];
};

const readAnalysis = (result: ScenarioResult): AnalysisRecord | null => {
  const path = resolve(REPOSITORY_ROOT, result.runDir, 'analysis.json');
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf-8')) as AnalysisRecord) : null;
};

const toSummaryRun = (result: ScenarioResult): SummaryRun => {
  const analysis = readAnalysis(result);
  const suggestion = analysis?.analysis;
  return {
    scenarioId: result.scenario.id,
    title: result.scenario.title.replace(new RegExp(`^${result.scenario.id}\\s*`), ''),
    runName: result.runName,
    verdict: result.verdict,
    durationMs: result.durationMs,
    aiSuggestion:
      suggestion === undefined || suggestion === null
        ? null
        : `${suggestion.suggestedHumanVerdict.value}, ${suggestion.proposedSeverity.level}`,
    aiCostUsd: analysis?.costUsd ?? null,
  };
};

/** 이번 일괄 실행보다 앞선 가장 최근 요약. 결함을 주입한 일괄 실행은 건너뛴다. 없으면 null이다. */
const previousSummary = (batchId: string): BatchSummary | null => {
  if (!existsSync(RUNS_DIR)) return null;
  const candidates = readdirSync(RUNS_DIR)
    .map((name) => SUMMARY_FILE.exec(name)?.[1])
    .filter((id): id is string => id !== undefined && id < batchId)
    .sort()
    .reverse();
  for (const id of candidates) {
    const summary = JSON.parse(readFileSync(resolve(RUNS_DIR, `summary-${id}.json`), 'utf-8')) as BatchSummary;
    if (!summary.faultInjection) return summary;
  }
  return null;
};

const describeChange = (previous: Verdict | undefined, current: Verdict): string => {
  if (previous === undefined) return '직전 기록 없음';
  if (previous === current) return '같음';
  if (current === 'PASS') return `회복(${previous} → PASS)`;
  if (previous === 'PASS') return `**새로 실패**(PASS → ${current})`;
  return `**바뀜**(${previous} → ${current})`;
};

/** 자동화한 Scenario가 검증하는 인수 기준. Scenario 문서의 근거 칸을 기준으로 센다. */
const coverage = () => {
  const scenarios = listScenarios();
  const automated = scenarios.filter((scenario) => scenario.status === '자동화');
  const covered = new Set(
    automated.flatMap((scenario) =>
      [scenario.basis, ...scenario.expected.map((expected) => expected.basis)].flatMap(
        (text) => text.match(AC_ID) ?? [],
      ),
    ),
  );
  const defined = new Set(
    readdirSync(SPEC_DIR)
      .filter((name) => name.endsWith('.md'))
      .flatMap((name) =>
        [...readFileSync(resolve(SPEC_DIR, name), 'utf-8').matchAll(/^\|\s*(AC-[A-Z]+-\d{3})\s*\|/gm)].map(
          (match) => match[1],
        ),
      ),
  );
  return {
    scenarioCount: scenarios.length,
    automated: automated.map((scenario) => scenario.id),
    covered: [...covered].filter((id) => defined.has(id)).sort(),
    definedCount: defined.size,
  };
};

const seconds = (ms: number): string => `${Math.round(ms / 1000)}초`;

const renderSummary = (summary: BatchSummary, previous: BatchSummary | null): string => {
  const previousVerdicts = new Map(previous?.runs.map((run) => [run.scenarioId, run.verdict]) ?? []);
  const changes = summary.runs.map((run) => ({ run, change: describeChange(previousVerdicts.get(run.scenarioId), run.verdict) }));
  const changed = changes.filter(({ run }) => previousVerdicts.has(run.scenarioId) && previousVerdicts.get(run.scenarioId) !== run.verdict);
  const missing = [...previousVerdicts.keys()].filter((id) => !summary.runs.some((run) => run.scenarioId === id));
  const counts = (['FAIL', 'NEEDS_REVIEW', 'BLOCKED', 'PASS'] as const)
    .map((verdict) => `${verdict} ${summary.runs.filter((run) => run.verdict === verdict).length}`)
    .join(', ');
  const analyses = summary.runs.filter((run) => run.aiSuggestion !== null);
  const cost = analyses.reduce((sum, run) => sum + (run.aiCostUsd ?? 0), 0);
  const scope = coverage();
  const build = summary.backendBuild === null ? '확인하지 못함' : `${summary.backendBuild.version} (${summary.backendBuild.commit})`;

  // 사람이 먼저 볼 Run: 직전 기록이 있으면 판정이 바뀐 Run, 없으면 PASS가 아닌 Run
  const firstLook = previous === null ? summary.runs.filter((run) => run.verdict !== 'PASS') : changed.map(({ run }) => run);

  const faultBanner =
    summary.faultInjection === null
      ? ''
      : `> **의도적 결함 주입 일괄 실행이다.** \`${summary.faultInjection}\`. 실제 제품 결함이 아니며, 다음 일괄 실행의 비교 기준으로 쓰지 않는다.\n\n`;

  return `# QA 일괄 실행 요약 ${summary.batchId}

${faultBanner}## 실행 정보

${table(
  ['항목', '내용'],
  [
    ['일시', `${kst(summary.startedAt)} ~ ${kst(summary.finishedAt)} (KST)`],
    ['대상 환경', `${environmentLabel(summary.baseUrl)} (${summary.baseUrl})`],
    ['대상 버전', build],
    ['Scenario 수', summary.runs.length],
    ['소요 시간', `테스트 ${seconds(summary.runs.reduce((sum, run) => sum + run.durationMs, 0))}, AI 분석 포함 전체 ${seconds(new Date(summary.finishedAt).getTime() - new Date(summary.startedAt).getTime())}`],
    ['AI 분석', analyses.length === 0 ? '없음' : `${analyses.length}건, 추정 비용 $${cost.toFixed(2)}`],
    ['비교 대상', previous === null ? '직전 일괄 실행 없음' : `[summary-${previous.batchId}](summary-${previous.batchId}.md)`],
  ],
)}

## 결과

- 판정 집계: ${counts}
- 직전 대비 판정이 바뀐 Scenario: ${previous === null ? '비교할 직전 실행 없음' : changed.length === 0 ? '없음' : changed.map(({ run, change }) => `${run.scenarioId} ${change}`).join(', ')}${missing.length === 0 ? '' : `\n- 직전에는 있었지만 이번에 실행하지 않은 Scenario: ${missing.join(', ')}`}
- 먼저 볼 Run: ${firstLook.length === 0 ? '없음' : firstLook.map((run) => `[${run.runName}](${run.runName}/report.md)`).join(', ')}

${table(
  ['Scenario', '상황', '판정', '직전 대비', '소요 시간', 'AI 제안', 'Run Report'],
  changes.map(({ run, change }) => [
    run.scenarioId,
    run.title,
    run.verdict,
    change,
    seconds(run.durationMs),
    run.aiSuggestion ?? '-',
    `[${run.runName}](${run.runName}/report.md)`,
  ]),
)}

## 검증 범위

Scenario 문서를 기준으로 센다. 이번에 실행하지 않은 Scenario도 포함한다.

${table(
  ['항목', '값'],
  [
    ['자동화한 Scenario', `${scope.automated.length}개 / 전체 Scenario ${scope.scenarioCount}개`],
    ['자동화한 Scenario가 검증하는 인수 기준', `${scope.covered.length}개 / 명세의 인수 기준 ${scope.definedCount}개`],
    ['검증하는 인수 기준', scope.covered.join(', ') || '-'],
  ],
)}
`;
};

/** 일괄 실행 요약을 만들고 경로와 직전 대비 바뀐 Scenario 수를 돌려준다. */
export const writeBatchSummary = (
  results: ScenarioResult[],
  startedAt: Date,
): { path: string; changedCount: number | null } => {
  const finishedAt = new Date();
  const batchId = formatRunId(startedAt);
  const summary: BatchSummary = {
    batchId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    baseUrl: results[0].environment.baseUrl,
    backendBuild: results[0].environment.backendBuild,
    faultInjection: results[0].faultInjection?.name ?? null,
    runs: results.map(toSummaryRun),
  };
  const previous = previousSummary(batchId);
  writeFileSync(resolve(RUNS_DIR, `summary-${batchId}.json`), JSON.stringify(summary, null, 2));
  const path = resolve(RUNS_DIR, `summary-${batchId}.md`);
  writeFileSync(path, renderSummary(summary, previous));

  const previousVerdicts = new Map(previous?.runs.map((run) => [run.scenarioId, run.verdict]) ?? []);
  const changedCount =
    previous === null
      ? null
      : summary.runs.filter((run) => previousVerdicts.has(run.scenarioId) && previousVerdicts.get(run.scenarioId) !== run.verdict)
          .length;
  return { path, changedCount };
};
