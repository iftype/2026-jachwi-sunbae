import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { AnalysisRecord } from './ai-analysis';
import type { ScenarioResult } from './scenario-run';

// qa/docs/report-schema.md 형식의 Run Report(report.md)를 만든다.
// 사람 판정은 report.md에서 직접 채운다. 리포트를 다시 만들어도 채운 값은 유지한다.

const REPOSITORY_ROOT = resolve(__dirname, '../..');
const PLAYWRIGHT_VERSION = (
  JSON.parse(readFileSync(resolve(__dirname, '../node_modules/@playwright/test/package.json'), 'utf-8')) as {
    version: string;
  }
).version;
const HUMAN_FIELDS = ['판정', '최종 심각도', 'AI 판단', '조치', '판정자·일시'] as const;

type Cell = string | number | null | undefined;

const cell = (value: Cell): string =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .trim();

export const table = (headers: string[], rows: Cell[][]): string =>
  [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');

export const kst = (iso: string): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(iso),
  );

export const environmentLabel = (baseUrl: string): string => {
  const host = new URL(baseUrl).hostname;
  if (host === 'dev.jachwi-sunbae.kr') return 'DEV';
  if (host === 'localhost' || host === '127.0.0.1') return '로컬';
  return host;
};

const numbered = (items: string[]): string => items.map((item, index) => `${index + 1}. ${item}`).join('\n');
const ids = (values: string[]): string => (values.length === 0 ? '-' : values.join(', '));

type HumanJudgment = {
  /** Run 판정 표: 필드 → 내용 */
  run: Record<string, string>;
  /** 항목별 판단 표: 항목 → [AI 판단, 판정, 최종 심각도, 조치] */
  items: Record<string, string[]>;
  /** 항목별 판단의 기준이 된 AI 분석 시각. 이전 리포트에는 없다. */
  analyzedAt: string | null;
};

const ANALYSIS_MARKER = /<!-- 판단 기준 AI 분석: (.+?) -->/;

const ITEM_COLUMNS = ['AI 판단', '판정', '최종 심각도', '조치'] as const;

const splitRow = (line: string): string[] =>
  line
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((value) => value.trim());

/** 이미 있는 report.md에서 사람이 채운 사람 판정 값을 읽는다. */
const readHumanJudgment = (reportPath: string): HumanJudgment => {
  const judgment: HumanJudgment = { run: {}, items: {}, analyzedAt: null };
  if (!existsSync(reportPath)) return judgment;
  const markdown = readFileSync(reportPath, 'utf-8');
  const start = markdown.indexOf('## 사람 판정');
  if (start < 0) return judgment;
  const end = markdown.indexOf('\n## ', start + 1);
  const section = markdown.slice(start, end < 0 ? undefined : end);
  judgment.analyzedAt = ANALYSIS_MARKER.exec(section)?.[1] ?? null;

  let header: string | null = null;
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) {
      header = null;
      continue;
    }
    const cells = splitRow(line);
    if (header === null) {
      header = cells[0];
    } else if (!cells.every((value) => /^-+$/.test(value))) {
      if (header === '필드' && (HUMAN_FIELDS as readonly string[]).includes(cells[0])) judgment.run[cells[0]] = cells[1] ?? '';
      if (header === '항목') judgment.items[cells[0]] = cells.slice(2);
    }
  }
  return judgment;
};

const runInformation = (result: ScenarioResult, runDir: string): string => {
  const scenarioLink = relative(runDir, resolve(REPOSITORY_ROOT, result.scenario.path));
  const build = result.environment.backendBuild ?? null;
  return table(
    ['필드', '내용'],
    [
      ['Run ID', result.runName],
      ['Scenario', `[${result.scenario.title}](${scenarioLink}) (${result.scenario.status})`],
      ['환경', `${environmentLabel(result.environment.baseUrl)}, ${result.environment.baseUrl}`],
      ['대상 버전', build === null ? '확인 불가' : `백엔드 ${build.version} (commit ${build.commit.slice(0, 7)})`],
      ['실행 방식', `자동, Playwright ${PLAYWRIGHT_VERSION}`],
      ['시작 시각·소요 시간', `${kst(result.startedAt)} (KST), ${Math.round(result.durationMs / 1000)}초`],
      ['테스트 데이터', `닉네임 ${result.member.nickname}, 회원 ID ${result.member.memberId}`],
    ],
  );
};

const resultSummary = (result: ScenarioResult, analysis: AnalysisRecord | null): string => {
  const notPassed = result.expected.filter((expected) => expected.verdict !== 'PASS');
  const fallback =
    notPassed.length === 0
      ? '모든 Expected를 코드로 확인했다.'
      : notPassed.map((expected) => `${expected.id} ${expected.verdict}`).join(', ');
  return [
    `- 최종 판정: **${result.verdict}** (코드 판정)`,
    `- 한 줄 요약: ${analysis?.analysis?.summary ?? fallback}`,
  ].join('\n');
};

const expectedResults = (result: ScenarioResult, analysis: AnalysisRecord | null): string => {
  const drafts = new Map((analysis?.analysis?.expectedReviews ?? []).map((review) => [review.id, review]));
  return table(
    ['ID', '기대 결과', '근거', '실제 결과', '판정', '판정 주체', 'Evidence'],
    result.expected.map((expected) => {
      const draft = expected.verdict === 'NEEDS_REVIEW' ? drafts.get(expected.id) : undefined;
      return [
        expected.id,
        expected.expected,
        expected.basis,
        expected.actual,
        draft === undefined ? expected.verdict : `${expected.verdict}\nAI 초안: ${draft.verdict}`,
        draft === undefined ? expected.judgedBy : `${expected.judgedBy}, AI 초안`,
        ids(expected.evidence),
      ];
    }),
  );
};

const evidenceList = (result: ScenarioResult): string => {
  const rows = table(
    ['ID', '종류', '위치', '설명'],
    result.evidence.map((record) => [record.id, record.kind, `[${record.file}](${record.file})`, record.description]),
  );
  return result.missingEvidence.length === 0
    ? rows
    : `${rows}\n\n> Scenario가 요구했지만 수집하지 못한 Evidence: ${result.missingEvidence.join(', ')}`;
};

const otherObservations = (analysis: AnalysisRecord | null): string => {
  if (analysis === null || analysis.analysis === null) return 'AI 분석을 실행하지 않아 확인하지 않았다.';
  const items = analysis.analysis.otherObservations;
  if (items.length === 0) return '없음';
  return numbered(items.map((item) => `${item.text} (근거: ${ids(item.basis)} / Evidence: ${ids(item.evidence)})`));
};

const validationSummary = (validation: AnalysisRecord['validation']): string => {
  const problems = [
    validation.unknownSpecIds.length > 0 ? `없는 명세 ID ${validation.unknownSpecIds.join(', ')}` : null,
    validation.unknownEvidenceIds.length > 0 ? `없는 Evidence ID ${validation.unknownEvidenceIds.join(', ')}` : null,
    validation.claimsWithoutEvidence > 0 ? `Evidence 없는 주장 ${validation.claimsWithoutEvidence}건` : null,
  ].filter((problem): problem is string => problem !== null);
  return problems.length === 0 ? '문제 없음' : `${problems.join('\n')}\n해당 주장은 채택하지 않는다.`;
};

const aiAnalysis = (analysis: AnalysisRecord | null, runDir: string): string => {
  const command = `npm run analyze -- ${relative(resolve(REPOSITORY_ROOT, 'qa'), runDir)}`;
  if (analysis === null) return `AI 분석을 실행하지 않았다. 필요하면 \`${command}\`로 분석한다.`;
  if (analysis.analysis === null) return `AI 분석에 실패했다: ${analysis.error}\n\n다시 분석하려면 \`${command}\`를 실행한다.`;

  const result = analysis.analysis;
  const cost = analysis.costUsd === null ? '' : `, $${analysis.costUsd.toFixed(2)}`;
  const sections = [
    table(
      ['필드', '내용'],
      [
        ['문제 요약', result.summary],
        ['관련 근거', ids(result.basis)],
        ['원인 가설', numbered(result.hypotheses.map((item) => `${item.text} (${ids(item.evidence)})`)) || '-'],
        ['제안 심각도', `${result.proposedSeverity.level}: ${result.proposedSeverity.reason}`],
        ['확신도', result.confidence],
        ['판정 제안', `${result.suggestedHumanVerdict.value}: ${result.suggestedHumanVerdict.reason}`],
        ['추가 확인 제안', numbered(result.followUp) || '-'],
        ['인용 검증', validationSummary(analysis.validation)],
        [
          '분석 정보',
          `${analysis.analyzer.tool}, ${ids(analysis.analyzer.models)}, ${Math.round(analysis.durationMs / 1000)}초${cost}, 입력: [analysis-prompt.md](analysis-prompt.md)`,
        ],
      ],
    ),
  ];
  if (result.expectedReviews.length > 0) {
    sections.push(
      '### Expected 판정 초안',
      table(
        ['ID', 'AI 초안', '이유', 'Evidence'],
        result.expectedReviews.map((review) => [review.id, review.verdict, review.reason, ids(review.evidence)]),
      ),
    );
  }
  return sections.join('\n\n');
};

/** 값이 있는 줄만 `**제목** 내용` 형식으로 이어 붙인다. */
const labeled = (entries: [string, string | undefined][]): string =>
  entries
    .filter(([, value]) => value !== undefined && value.length > 0)
    .map(([label, value]) => `**${label}** ${value}`)
    .join('\n');

/** 사람이 하나씩 판단해야 하는 AI의 주장: Expected 판정 초안과 기타 관찰 */
const judgmentItems = (analysis: AnalysisRecord | null): { key: string; proposal: string }[] => {
  if (analysis === null || analysis.analysis === null) return [];
  return [
    ...analysis.analysis.expectedReviews.map((review) => ({
      key: `Expected ${review.id} 판정 초안`,
      proposal: labeled([
        ['제안', review.verdict],
        ['정리', review.reason],
        ['Evidence', ids(review.evidence)],
        ['확인 방법', review.howToVerify],
      ]),
    })),
    ...analysis.analysis.otherObservations.map((item, index) => ({
      key: `기타 관찰 ${index + 1}`,
      proposal: labeled([
        [
          '제안',
          item.suggestedVerdict === undefined
            ? undefined
            : `${item.suggestedVerdict}, 심각도 ${item.suggestedSeverity ?? '-'}`,
        ],
        ['정리', item.text],
        ['근거', ids(item.basis)],
        ['Evidence', ids(item.evidence)],
        ['확인 방법', item.howToVerify],
      ]),
    })),
  ];
};

/** 이전 리포트의 항목별 판단을 옮길 수 있는지. AI 분석이 바뀌었으면 같은 항목 이름이 다른 주장을 가리킬 수 있다. */
const canCarryItems = (preserved: HumanJudgment, analysis: AnalysisRecord | null): boolean =>
  preserved.analyzedAt === null || preserved.analyzedAt === analysis?.analyzedAt;

const humanJudgment = (
  preserved: HumanJudgment,
  result: ScenarioResult,
  analysis: AnalysisRecord | null,
  runDir: string,
): string => {
  const decisionLog = relative(runDir, resolve(REPOSITORY_ROOT, 'qa/docs/decision-log/README.md'));
  const lines = [
    `판정은 \`CONFIRMED_BUG\`, \`NOT_A_BUG\`, \`SPEC_GAP\`, \`TEST_ISSUE\`, \`ENV_ISSUE\` 중 하나다. AI 판단은 \`수용\`, \`수정\`, \`기각\` 중 하나다. 수정하거나 기각하면 [판단 기록](${decisionLog})을 남긴다.`,
    '',
    '### Run 판정',
    '',
    'Run 전체의 결함 여부다. AI 판단은 판정 제안과 원인 가설에 대한 판단이다.',
    '',
    ...(result.verdict === 'PASS'
      ? [
          '> 최종 판정이 `PASS`인 Run이다. 판정, 최종 심각도, AI 판단은 비우고, 조치에 `코드 판정 PASS 확인`을, 판정자·일시를 적는다.',
          '',
        ]
      : []),
    ...(analysis?.analysis
      ? [
          `> **AI 제안** ${analysis.analysis.suggestedHumanVerdict.value}, 심각도 ${analysis.analysis.proposedSeverity.level}, 확신도 ${analysis.analysis.confidence}. ${analysis.analysis.suggestedHumanVerdict.reason}`,
          '',
        ]
      : []),
    '| 필드 | 내용 |',
    '| --- | --- |',
    ...HUMAN_FIELDS.map((field) => `| ${field} | ${preserved.run[field] ?? ''} |`),
  ];

  const items = judgmentItems(analysis);
  const carry = canCarryItems(preserved, analysis);
  if (!carry && Object.values(preserved.items).some((values) => values.some((value) => value.length > 0))) {
    console.warn(`AI 분석이 바뀌어 이전 항목별 판단을 옮기지 않았습니다. 이전 분석 시각: ${preserved.analyzedAt}`);
  }
  if (items.length > 0) {
    lines.push(
      '',
      '### 항목별 판단',
      '',
      'AI가 낸 Expected 판정 초안과 기타 관찰을 하나씩 판단한다. Expected의 판정은 `PASS`, `FAIL`, `NEEDS_REVIEW`, 기타 관찰의 판정은 사람 판정값이다.',
      '',
      `<!-- 판단 기준 AI 분석: ${analysis?.analyzedAt} -->`,
      '',
      `| 항목 | AI 제안과 정리 | ${ITEM_COLUMNS.join(' | ')} |`,
      `| --- | --- | ${ITEM_COLUMNS.map(() => '---').join(' | ')} |`,
      ...items.map(({ key, proposal }) => {
        const values = ITEM_COLUMNS.map((_, index) => (carry ? (preserved.items[key]?.[index] ?? '') : ''));
        return `| ${key} | ${cell(proposal)} | ${values.join(' | ')} |`;
      }),
    );
  }
  return lines.join('\n');
};

const faultBanner = (result: ScenarioResult): string =>
  result.faultInjection === null
    ? ''
    : `> **의도적 결함 주입 Run이다.** \`${result.faultInjection.name}\`: ${result.faultInjection.description} 실제 제품 결함이 아니다. AI 분석에는 이 사실을 알리지 않았다.\n\n`;

/** Run 디렉터리의 result.json과 analysis.json으로 report.md를 만든다. */
export const writeReport = (runDir: string): string => {
  const result = JSON.parse(readFileSync(resolve(runDir, 'result.json'), 'utf-8')) as ScenarioResult;
  const analysisPath = resolve(runDir, 'analysis.json');
  const analysis = existsSync(analysisPath)
    ? (JSON.parse(readFileSync(analysisPath, 'utf-8')) as AnalysisRecord)
    : null;
  const reportPath = resolve(runDir, 'report.md');
  const preserved = readHumanJudgment(reportPath);

  const markdown = `# Run Report ${result.runName}

${faultBanner(result)}## 실행 정보

${runInformation(result, runDir)}

## 결과 요약

${resultSummary(result, analysis)}

## Expected별 결과

${expectedResults(result, analysis)}

## Evidence 목록

${evidenceList(result)}

## 기타 관찰

${otherObservations(analysis)}

## AI 분석

${aiAnalysis(analysis, runDir)}

## 사람 판정

${humanJudgment(preserved, result, analysis, runDir)}
`;
  writeFileSync(reportPath, markdown);
  return reportPath;
};
