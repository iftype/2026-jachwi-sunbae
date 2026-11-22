// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { VisualScope } from '../../scripts/visual-scope.mjs';
import {
  checkPrBody,
  classifyChangedFiles,
  findVisualScope,
  renderVerdictTemplate,
} from '../../scripts/visual-scope.mjs';

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

describe('PR 본문의 화면 판정 절 검사', () => {
  const routesScope: VisualScope = {
    runs: true,
    scope: 'routes',
    why: '바뀐 파일을 import하는 화면만 골랐다',
    changed: [],
    ignored: [],
    routes: ['/', '/properties/:propertyId'],
  };
  const body = (result: string, routes = '/, /properties/:propertyId') =>
    `## 작업 내용\n\n- 무엇\n\n## 화면 판정\n\n- 결과: ${result}\n- 영향 라우트: ${routes}\n- 증거: https://example.com/verdict.md\n\n## 테스트\n`;

  it('판정이 필요 없는 PR은 절이 없어도 통과한다', () => {
    expect(
      checkPrBody({ scope: { ...routesScope, runs: false, scope: 'none', routes: [] }, title: '', body: '' }),
    ).toEqual([]);
  });

  it('판정이 필요한데 절이 없으면 실패한다', () => {
    expect(checkPrBody({ scope: routesScope, title: '[FE][Feat] 무엇', body: '## 작업 내용' })).toHaveLength(1);
  });

  it('결과, 영향 라우트, 증거 링크를 갖추면 통과한다', () => {
    expect(checkPrBody({ scope: routesScope, title: '[FE][Feat] 무엇', body: body('좋아짐') })).toEqual([]);
  });

  it('영향 라우트가 빠지면 실패한다', () => {
    expect(checkPrBody({ scope: routesScope, title: '[FE][Feat] 무엇', body: body('같음', '/') })).toEqual([
      '영향 라우트에 빠진 화면이 있다: /properties/:propertyId',
    ]);
  });

  it('나빠짐이면 실패한다', () => {
    expect(checkPrBody({ scope: routesScope, title: '[FE][Perf] 무엇', body: body('나빠짐') })).toHaveLength(1);
  });

  it('리팩터링 PR은 같음이 아니면 실패한다', () => {
    expect(checkPrBody({ scope: routesScope, title: '[FE][Refactor] 무엇', body: body('좋아짐') })).toHaveLength(1);
    expect(checkPrBody({ scope: routesScope, title: '[FE][Refactor] 무엇', body: body('같음') })).toEqual([]);
  });

  it('범위가 전체면 주요 화면 전체라고 쓴다', () => {
    const allScope: VisualScope = { ...routesScope, scope: 'all', why: '번들 설정' };

    expect(checkPrBody({ scope: allScope, title: '', body: body('같음', '/') })).toHaveLength(1);
    expect(checkPrBody({ scope: allScope, title: '', body: body('같음', '주요 화면 전체') })).toEqual([]);
  });
});

describe('PR 올리기 전 판정 틀', () => {
  it('범위 밖이면 판정 필요 없음을 낸다', async () => {
    const scope = await findVisualScope(['frontend/docs/x.md']);

    expect(renderVerdictTemplate(scope)).toMatch(/^화면 판정 필요 없음/);
  });

  it('범위 안이면 볼 화면을 채운 빈 틀을 내고, 그 틀은 결과와 증거를 채우면 검사를 통과한다', async () => {
    const scope = await findVisualScope(['frontend/src/pages/property-photos/PropertyPhotosPage.tsx']);
    const filled = renderVerdictTemplate(scope)
      .replace('(같음, 좋아짐, 나빠짐 중 하나)', '같음')
      .replace('(verdict.md와 같은 시각 나란히 보기 그림 링크)', 'https://example.com/verdict.md');

    expect(renderVerdictTemplate(scope)).toContain('- 영향 라우트: /properties/:propertyId/photos');
    expect(checkPrBody({ scope, title: '[FE][Refactor] x', body: filled })).toEqual([]);
  });
});
