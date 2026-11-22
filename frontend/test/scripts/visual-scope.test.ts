// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { compareMetric, JITTER_VERDICT } from '../../../.claude/skills/verify-jachwi/scripts/verdict.mjs';
import {
  checkVerdict,
  classifyChangedFiles,
  findVisualScope,
  renderVerdictTemplate,
} from '../../scripts/visual-scope.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('화면 검증을 돌릴 변경 고르기', () => {
  it('실행되는 프론트 코드, 스타일, 에셋은 대상이다', () => {
    const { runtime } = classifyChangedFiles([
      'frontend/src/pages/home/HomePage.tsx',
      'frontend/src/shared/lib/hooks/useIsDesktop.ts',
      'frontend/src/shared/assets/logo.png',
    ]);

    expect(runtime).toHaveLength(3);
  });

  it('번들과 로딩에 닿는 설정은 대상이다', () => {
    const { config } = classifyChangedFiles([
      'frontend/webpack/webpack.config.cjs',
      'frontend/index.html',
      'frontend/public/robots.txt',
      'frontend/package-lock.json',
      'frontend/package.json',
    ]);

    expect(config).toHaveLength(5);
  });

  it('package.json은 의존성이 바뀌지 않았으면 대상이 아니다', () => {
    const { config, ignored } = classifyChangedFiles(['frontend/package.json'], { packageDependenciesChanged: false });

    expect(config).toEqual([]);
    expect(ignored).toEqual(['frontend/package.json']);
  });

  it('테스트, 스토리, 타입 선언, 목, 문서, CI, 스크립트만 바뀌면 대상이 아니다', () => {
    const { runtime, config } = classifyChangedFiles([
      'frontend/src/pages/home/HomePage.test.tsx',
      'frontend/src/shared/ui/button/Button.stories.tsx',
      'frontend/src/global.d.ts',
      'frontend/src/app/mocks/handlers/authHandlers.ts',
      'frontend/test/app/App.test.tsx',
      'frontend/docs/testing-strategy.md',
      '.github/workflows/frontend-ci.yml',
      'frontend/scripts/reachable-routes.mjs',
    ]);

    expect(runtime).toEqual([]);
    expect(config).toEqual([]);
  });
});

describe('바뀐 파일로 판정 범위 정하기', () => {
  it('범위 밖: 문서, 테스트, 스크립트만 바뀌면 판정이 필요 없다', async () => {
    const scope = await findVisualScope(['frontend/docs/testing-strategy.md', 'frontend/scripts/reachable-routes.mjs']);

    expect(scope.runs).toBe(false);
    expect(scope.routes).toEqual([]);
  });

  it('범위 안: 한 화면만 쓰는 파일이 바뀌면 그 화면만 고른다', async () => {
    const scope = await findVisualScope(['frontend/src/pages/property-photos/PropertyPhotosPage.tsx']);

    expect(scope).toMatchObject({ runs: true, scope: 'routes', routes: ['/properties/:propertyId/photos'] });
  });

  it('섞인 경우: 범위 밖 파일은 무시하고 범위 안 파일로 고른다', async () => {
    const scope = await findVisualScope([
      'frontend/docs/testing-strategy.md',
      'frontend/src/pages/checklist-detail/ChecklistDetailPage.tsx',
      'frontend/src/pages/checklist-detail/ChecklistDetailPage.test.tsx',
    ]);

    expect(scope).toMatchObject({ runs: true, scope: 'routes', routes: ['/checklists/:checklistId'] });
  });

  it('번들 설정이 바뀌면 주요 화면 전체다', async () => {
    const scope = await findVisualScope(['frontend/webpack/webpack.config.cjs', 'frontend/docs/x.md']);

    expect(scope.scope).toBe('all');
    expect(scope.routes).toContain('/');
  });

  it('앱 입구가 쓰는 공용 파일이 바뀌면 주요 화면 전체다', async () => {
    const scope = await findVisualScope(['frontend/src/features/auth/api/apiClient.ts']);

    expect(scope.scope).toBe('all');
  });
});

describe('CI 자동 판정 결과로 통과 정하기', () => {
  it('같음, 좋아짐은 통과한다', () => {
    expect(checkVerdict({ title: '[FE][Feat] 무엇', verdict: '같음' })).toEqual([]);
    expect(checkVerdict({ title: '[FE][Perf] 무엇', verdict: '좋아짐' })).toEqual([]);
  });

  it('나빠짐이면 실패한다', () => {
    expect(checkVerdict({ title: '[FE][Perf] 무엇', verdict: '나빠짐' })).toHaveLength(1);
  });

  it('리팩터링 PR은 같음이 아니면 실패한다', () => {
    expect(checkVerdict({ title: '[FE][Refactor] 무엇', verdict: '좋아짐' })).toHaveLength(1);
    expect(checkVerdict({ title: '[FE][Refactor] 무엇', verdict: '판정 못 함' })).toHaveLength(1);
    expect(checkVerdict({ title: '[FE][Refactor] 무엇', verdict: '판정 불가(흔들림 큼)' })).toHaveLength(1);
    expect(checkVerdict({ title: '[FE][Refactor] 무엇', verdict: '같음' })).toEqual([]);
  });

  it('대상이 아니거나 잴 화면이 없으면 통과한다', () => {
    expect(checkVerdict({ title: '[FE][Refactor] 무엇', verdict: '대상 아님' })).toEqual([]);
    expect(checkVerdict({ title: '[FE][Refactor] 무엇', verdict: '잴 화면 없음' })).toEqual([]);
  });
});

describe('PR 올리기 전 안내', () => {
  it('범위 밖이면 판정 필요 없음을 낸다', async () => {
    const scope = await findVisualScope(['frontend/docs/x.md']);

    expect(renderVerdictTemplate(scope)).toMatch(/^화면 판정 필요 없음/);
  });

  it('범위 안이면 볼 화면과 CI 댓글을 가리키는 절을 낸다', async () => {
    const scope = await findVisualScope(['frontend/src/pages/property-photos/PropertyPhotosPage.tsx']);
    const template = renderVerdictTemplate(scope);

    expect(template).toContain('- 영향 라우트: /properties/:propertyId/photos');
    expect(template).toContain('CI 댓글');
  });
});

describe('흔들림이 큰 측정', () => {
  it('흩어짐이 상한을 넘으면 같음으로 뭉개지 않고 판정 불가를 낸다', () => {
    const metric = compareMetric([1000, 1400, 1100], [1050, 1500, 1000], { maxSpread: 250 });

    expect(metric.verdict).toBe(JITTER_VERDICT);
  });

  it('상한 안이면 지금처럼 문턱으로 판정한다', () => {
    expect(compareMetric([1000, 1100], [1050, 1120], { maxSpread: 250 }).verdict).toBe('같음');
    expect(compareMetric([1000, 1100], [1500, 1550], { maxSpread: 250 }).verdict).toBe('나빠짐');
  });

  it('상한이 0이면(지도 SDK 목, CI) 흩어짐이 커도 문턱으로만 판정한다', () => {
    expect(compareMetric([1000, 1400], [1050, 1450]).verdict).toBe('같음');
  });
});

describe('develop 필수 검사 Check visual verdict', () => {
  const workflow = readFileSync(join(repoRoot, '.github/workflows/visual-verdict.yml'), 'utf8');

  it('모든 PR에서 결과를 남기도록 paths 필터 없이 develop PR에 돈다', () => {
    expect(workflow).not.toMatch(/^\s*paths(-ignore)?:/m);
    expect(workflow).toMatch(/^\s*types: \[opened, synchronize, reopened\]$/m);
    expect(workflow).toMatch(/^\s*- develop$/m);
  });

  it('체크 이름은 Check visual verdict 이고 잡 전체를 건너뛰는 조건이 없다', () => {
    expect(workflow).toMatch(/^ {4}name: Check visual verdict$/m);
    expect(workflow).not.toMatch(/^ {4}if:/m);
  });

  it('전 화면 판정은 PR 라벨로 돌지 않는다', () => {
    const full = readFileSync(join(repoRoot, '.github/workflows/visual-verdict-full.yml'), 'utf8');

    expect(full).not.toMatch(/pull_request|labeled/);
  });
});
