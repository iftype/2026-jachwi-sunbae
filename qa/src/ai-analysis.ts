import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ScenarioResult } from './scenario-run';

// qa/docs/report-schema.md 2.6 AI 분석: Run의 결과와 Evidence를 `claude -p`로 분석한다.
// AI는 판정 초안과 원인 가설만 낸다. 최종 판정은 사람이 한다.

const REPOSITORY_ROOT = resolve(__dirname, '../..');
const SPEC_DIR = resolve(REPOSITORY_ROOT, 'docs/product/specs');
const STANDARD_DOCS = ['qa/docs/source-of-truth.md', 'qa/docs/report-schema.md', 'docs/product/README.md'];
const SPEC_ID = /\b(?:REQ|POL|AC)-[A-Z]+-\d{2,3}\b/g;
const INLINE_LIMIT = 15_000;
const TIMEOUT_MS = Number(process.env.QA_AI_TIMEOUT_MS) || 300_000;
// 분석 기준이 Claude Code 기본 모델 변경에 따라 바뀌지 않도록 모델 ID를 고정한다. (DL-002)
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const analysisModel = (): string => process.env.QA_AI_MODEL?.trim() || DEFAULT_MODEL;

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
type HumanVerdict = 'CONFIRMED_BUG' | 'NOT_A_BUG' | 'SPEC_GAP' | 'TEST_ISSUE' | 'ENV_ISSUE';

export type AiAnalysis = {
  summary: string;
  basis: string[];
  hypotheses: { text: string; evidence: string[] }[];
  proposedSeverity: { level: Severity; reason: string };
  confidence: '높음' | '중간' | '낮음';
  suggestedHumanVerdict: { value: HumanVerdict; reason: string };
  followUp: string[];
  // howToVerify, suggestedVerdict, suggestedSeverity는 나중에 추가한 필드라 이전 분석 결과에는 없을 수 있다.
  expectedReviews: {
    id: string;
    verdict: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
    reason: string;
    evidence: string[];
    howToVerify?: string;
  }[];
  otherObservations: {
    text: string;
    basis: string[];
    evidence: string[];
    suggestedVerdict?: HumanVerdict;
    suggestedSeverity?: Severity;
    howToVerify?: string;
  }[];
};

export type AnalysisRecord = {
  status: 'COMPLETED' | 'FAILED';
  analyzedAt: string;
  analyzer: { tool: 'claude -p'; models: string[] };
  durationMs: number;
  costUsd: number | null;
  analysis: AiAnalysis | null;
  /** AI가 인용했지만 실제로 없는 ID. 해당 주장은 채택하지 않는다. */
  validation: { unknownSpecIds: string[]; unknownEvidenceIds: string[]; claimsWithoutEvidence: number };
  error: string | null;
};

const stringArray = { type: 'array', items: { type: 'string' } };
// 근거 칸과 Evidence 칸에는 ID만 넣게 한다. 문장을 넣으면 출력 단계에서 거부된다. (DL-002)
const specIdArray = { type: 'array', items: { type: 'string', pattern: '^(REQ|POL|AC)-[A-Z]+-[0-9]{2,3}$' } };
const evidenceIdArray = { type: 'array', items: { type: 'string', pattern: '^EV\\+?[0-9]+$' } };
const withEvidence = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const ANALYSIS_SCHEMA = withEvidence({
  summary: { type: 'string' },
  basis: specIdArray,
  hypotheses: { type: 'array', items: withEvidence({ text: { type: 'string' }, evidence: evidenceIdArray }) },
  proposedSeverity: withEvidence({
    level: { enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] },
    reason: { type: 'string' },
  }),
  confidence: { enum: ['높음', '중간', '낮음'] },
  suggestedHumanVerdict: withEvidence({
    value: { enum: ['CONFIRMED_BUG', 'NOT_A_BUG', 'SPEC_GAP', 'TEST_ISSUE', 'ENV_ISSUE'] },
    reason: { type: 'string' },
  }),
  followUp: stringArray,
  expectedReviews: {
    type: 'array',
    items: withEvidence({
      id: { type: 'string' },
      verdict: { enum: ['PASS', 'FAIL', 'NEEDS_REVIEW'] },
      reason: { type: 'string' },
      evidence: evidenceIdArray,
      howToVerify: { type: 'string' },
    }),
  },
  otherObservations: {
    type: 'array',
    items: withEvidence({
      text: { type: 'string' },
      basis: specIdArray,
      evidence: evidenceIdArray,
      suggestedVerdict: { enum: ['CONFIRMED_BUG', 'NOT_A_BUG', 'SPEC_GAP', 'TEST_ISSUE', 'ENV_ISSUE'] },
      suggestedSeverity: { enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] },
      howToVerify: { type: 'string' },
    }),
  },
});

const readRepositoryFile = (path: string): string => readFileSync(resolve(REPOSITORY_ROOT, path), 'utf-8');

const specFiles = (): string[] =>
  readdirSync(SPEC_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => `docs/product/specs/${name}`);

const knownSpecIds = (): Set<string> =>
  new Set(specFiles().flatMap((path) => readRepositoryFile(path).match(SPEC_ID) ?? []));

const section = (title: string, path: string, content: string): string =>
  `### ${title} (\`${path}\`)\n\n${content.trim()}\n`;

const evidenceSection = (result: ScenarioResult, runDir: string): string =>
  result.evidence
    .map((record) => {
      const absolutePath = resolve(runDir, record.file);
      const header = `#### ${record.id} ${record.kind}: ${record.description}\n파일: ${absolutePath}`;
      if (record.file.endsWith('.json')) {
        const content = readFileSync(absolutePath, 'utf-8');
        const body = content.length > INLINE_LIMIT ? `${content.slice(0, INLINE_LIMIT)}\n...(이하 생략)` : content;
        return `${header}\n\n\`\`\`json\n${body}\n\`\`\``;
      }
      if (record.file.endsWith('.png')) return `${header}\n(이미지. Read 도구로 열어 확인한다.)`;
      return `${header}\n(바이너리 파일. 열지 않는다.)`;
    })
    .join('\n\n');

export const buildPrompt = (result: ScenarioResult, runDir: string): string => {
  const scenario = readRepositoryFile(result.scenario.path);
  const { faultInjection: _faultInjection, ...visibleResult } = result;

  return `너는 자취선배 QA의 분석 담당이다. 아래 기준 문서를 따라 Scenario 실행(Run) 결과와 Evidence를 분석하고, 지정된 JSON 형식으로만 답한다.

## 규칙

1. 정답 근거는 아래 "QA 기준"과 "제품 명세"뿐이다. 현재 구현의 동작, 일반 상식, 다른 서비스의 관례를 정답 근거로 쓰지 않는다.
2. 모든 주장(원인 가설, Expected 판정 초안, 기타 관찰)에는 Evidence ID(예: EV1, EV+2)를 붙인다. Evidence로 뒷받침할 수 없는 주장은 쓰지 않는다.
3. 명세 ID(REQ, POL, AC)는 아래 제품 명세에 실제로 있는 것만 쓴다. 위반한 명세 ID를 지목할 수 없으면 FAIL이 아니라 NEEDS_REVIEW다.
4. 코드가 PASS나 FAIL로 판정한 Expected는 다시 판정하지 않는다. 판정이 NEEDS_REVIEW인 Expected만 expectedReviews에 판정 초안을 내고, 사람이 그 초안을 확인할 방법(howToVerify)을 함께 쓴다. BLOCKED인 Expected는 원인 가설에서 다룬다.
5. 코드의 판정 자체가 잘못됐을 수 있다. Evidence가 Scenario의 기대 결과와 일치하는데 코드가 FAIL로 판정했다면 그 가능성을 원인 가설로 쓰고 suggestedHumanVerdict를 TEST_ISSUE로 제안한다.
6. Expected 밖이지만 Evidence에서 명세와 다른 점을 발견하면 otherObservations에 근거 명세 ID와 함께 남긴다. 최종 판정은 사람이 하지만, 사람 판정값 제안(suggestedVerdict), 심각도 제안(suggestedSeverity), 사람이 확인할 방법(howToVerify)을 함께 낸다. 명세와 다르지 않은 정상 동작은 기타 관찰로 쓰지 않는다.
7. 스크린샷(png)은 Read 도구로 직접 열어 확인한다. 다른 파일을 찾거나 수정하지 않는다.
8. 최종 판정은 사람이 한다. 너는 초안과 가설만 낸다. 한국어로 간결하게 쓴다.
9. 최종 판정이 PASS인 Run이면 원인 가설은 비우고, proposedSeverity는 NONE, suggestedHumanVerdict는 NOT_A_BUG로 둔다. 이때는 기타 관찰을 찾는 데 집중한다.

## QA 기준

${STANDARD_DOCS.slice(0, 2)
  .map((path) => section(path.endsWith('source-of-truth.md') ? 'QA 정답 기준' : 'QA 실행 결과 형식', path, readRepositoryFile(path)))
  .join('\n')}

## 제품 명세

${section('제품 개요와 공통 정책', STANDARD_DOCS[2], readRepositoryFile(STANDARD_DOCS[2]))}
${specFiles()
  .map((path) => section('기능 명세', path, readRepositoryFile(path)))
  .join('\n')}

## Scenario

${section(result.scenario.title, result.scenario.path, scenario)}

## 이번 Run 결과 (result.json)

\`\`\`json
${JSON.stringify(visibleResult, null, 2)}
\`\`\`

## Evidence

${evidenceSection(result, runDir)}
`;
};

type CliOutput = {
  is_error?: boolean;
  result?: string;
  structured_output?: AiAnalysis;
  total_cost_usd?: number;
  modelUsage?: Record<string, unknown>;
};

const runClaude = (prompt: string, runDir: string): Promise<CliOutput> =>
  new Promise((resolvePromise, reject) => {
    const args = [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(ANALYSIS_SCHEMA),
      // 분석에 필요한 읽기 도구만 주고, 설정과 MCP 서버를 불러오지 않는다.
      '--restricted',
      '--tools',
      'Read',
      '--allowedTools',
      'Read',
      '--strict-mcp-config',
      '--no-session-persistence',
      '--add-dir',
      runDir,
      '--model',
      analysisModel(),
    ];
    const child = spawn('claude', args, { cwd: REPOSITORY_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`claude -p가 ${TIMEOUT_MS / 1000}초 안에 끝나지 않았습니다.`));
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI를 실행하지 못했습니다: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude -p 종료 코드 ${code}: ${(stderr || stdout).slice(0, 500)}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout) as CliOutput);
      } catch {
        reject(new Error(`claude -p 출력을 JSON으로 읽지 못했습니다: ${stdout.slice(0, 500)}`));
      }
    });
    child.stdin.end(prompt);
  });

/** AI가 인용한 명세 ID와 Evidence ID가 실제로 있는지 확인한다. */
export const validateAnalysis = (analysis: AiAnalysis, result: ScenarioResult): AnalysisRecord['validation'] => {
  const specIds = knownSpecIds();
  const evidenceIds = new Set(result.evidence.map((record) => record.id));
  // 근거 칸에는 명세 ID만 정확히 쓴다. 문장 속에 인용한 ID도 실제로 있는지 확인한다.
  const basisEntries = [...analysis.basis, ...analysis.otherObservations.flatMap((item) => item.basis)];
  const citedSpecIds = new Set([...basisEntries, ...(JSON.stringify(analysis).match(SPEC_ID) ?? [])]);
  const citedEvidence = [
    ...analysis.hypotheses.flatMap((item) => item.evidence),
    ...analysis.expectedReviews.flatMap((item) => item.evidence),
    ...analysis.otherObservations.flatMap((item) => item.evidence),
  ];
  const claims = [...analysis.hypotheses, ...analysis.expectedReviews, ...analysis.otherObservations];

  return {
    unknownSpecIds: [...citedSpecIds].filter((id) => !specIds.has(id)),
    unknownEvidenceIds: [...new Set(citedEvidence)].filter((id) => !evidenceIds.has(id)),
    claimsWithoutEvidence: claims.filter((claim) => claim.evidence.length === 0).length,
  };
};

/** Run 디렉터리의 결과를 분석해 `analysis.json`과 보낸 프롬프트(`analysis-prompt.md`)를 남긴다. */
export const analyzeRun = async (runDir: string): Promise<AnalysisRecord> => {
  const result = JSON.parse(readFileSync(resolve(runDir, 'result.json'), 'utf-8')) as ScenarioResult;
  const prompt = buildPrompt(result, runDir);
  writeFileSync(resolve(runDir, 'analysis-prompt.md'), prompt);

  const startedAt = Date.now();
  let record: AnalysisRecord;
  try {
    const output = await runClaude(prompt, runDir);
    if (output.is_error || output.structured_output === undefined) {
      throw new Error(`구조화된 분석 결과를 받지 못했습니다: ${String(output.result).slice(0, 500)}`);
    }
    record = {
      status: 'COMPLETED',
      analyzedAt: new Date().toISOString(),
      analyzer: { tool: 'claude -p', models: Object.keys(output.modelUsage ?? {}) },
      durationMs: Date.now() - startedAt,
      costUsd: output.total_cost_usd ?? null,
      analysis: output.structured_output,
      validation: validateAnalysis(output.structured_output, result),
      error: null,
    };
  } catch (error) {
    record = {
      status: 'FAILED',
      analyzedAt: new Date().toISOString(),
      analyzer: { tool: 'claude -p', models: [] },
      durationMs: Date.now() - startedAt,
      costUsd: null,
      analysis: null,
      validation: { unknownSpecIds: [], unknownEvidenceIds: [], claimsWithoutEvidence: 0 },
      error: error instanceof Error ? error.message : String(error),
    };
  }

  writeFileSync(resolve(runDir, 'analysis.json'), JSON.stringify(record, null, 2));
  return record;
};
