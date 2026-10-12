import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// Scenario 문서(Markdown)에서 상태와 Expected 표를 직접 읽는다.
// 기대 결과를 코드에 다시 적지 않아서, 문서를 고치면 실행 결과에도 그대로 반영된다.
const SCENARIO_DIR = resolve(__dirname, '../docs/scenarios');
const REPOSITORY_ROOT = resolve(__dirname, '../..');

export type ScenarioExpected = {
  id: string;
  text: string;
  basis: string;
  judgedBy: string;
};

export type ScenarioEvidence = {
  id: string;
  text: string;
  targets: string[];
};

export type ScenarioDoc = {
  id: string;
  title: string;
  status: string;
  /** 머리 표의 근거 명세 ID */
  basis: string;
  /** 저장소 루트 기준 경로 */
  path: string;
  markdown: string;
  expected: ScenarioExpected[];
  requiredEvidence: ScenarioEvidence[];
};

/** `## 제목` 아래 첫 Markdown 표의 본문 행을 셀 배열로 읽는다. 머리글과 구분선은 제외한다. */
const readTable = (markdown: string, heading: string | null): string[][] => {
  const lines = markdown.split('\n');
  const start = heading === null ? 0 : lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return [];

  const rows: string[][] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (!line.trim().startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    rows.push(
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    );
  }
  return rows.slice(2);
};

/**
 * `qa/docs/scenarios/`의 Scenario 문서를 읽는다.
 * Expected와 Required Evidence를 코드에 다시 적지 않고 문서에서 가져와 문서와 실행 결과가 어긋나지 않게 한다.
 */
export const loadScenario = (scenarioId: string): ScenarioDoc => {
  const fileName = readdirSync(SCENARIO_DIR).find((name) => name.startsWith(`${scenarioId}-`) && name.endsWith('.md'));
  if (fileName === undefined) {
    throw new Error(`${scenarioId} Scenario 문서를 ${SCENARIO_DIR}에서 찾지 못했습니다.`);
  }

  const filePath = resolve(SCENARIO_DIR, fileName);
  const markdown = readFileSync(filePath, 'utf-8');
  const title = markdown.split('\n')[0].replace(/^#\s+/, '');
  const meta = Object.fromEntries(readTable(markdown, null).map(([key, value]) => [key, value]));

  return {
    id: scenarioId,
    title,
    status: meta['상태'] ?? '',
    basis: meta['근거'] ?? '',
    path: relative(REPOSITORY_ROOT, filePath),
    markdown,
    expected: readTable(markdown, 'Expected').map(([id, text, basis, judgedBy]) => ({ id, text, basis, judgedBy })),
    requiredEvidence: readTable(markdown, 'Required Evidence').map(([id, text, targets]) => ({
      id,
      text,
      targets: targets.split(',').map((target) => target.trim()),
    })),
  };
};

/** `qa/docs/scenarios/`의 모든 Scenario 문서를 ID 순서로 읽는다. */
export const listScenarios = (): ScenarioDoc[] =>
  readdirSync(SCENARIO_DIR)
    .map((name) => /^(F\d{2}-S\d{2})-.+\.md$/.exec(name)?.[1])
    .filter((id): id is string => id !== undefined)
    .sort()
    .map(loadScenario);
