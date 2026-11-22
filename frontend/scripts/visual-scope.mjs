// 화면 판정 범위 규칙의 유일한 출처다. 바뀐 파일로 화면 판정(verify-jachwi 스킬)이 필요한지와, 전후 판정할 화면(라우트)을 고른다.
// 스킬과 CI(.github/workflows/visual-verdict.yml)가 모두 이 스크립트를 부른다. 규칙을 다른 곳에 옮겨 적지 않는다.
// 사용법(frontend 폴더에서):
//   npm run verify:pr [-- --base upstream/develop]   PR 올리기 전에: 판정이 필요한지, 볼 화면, "## 화면 판정" 빈 틀을 낸다
//   node scripts/visual-scope.mjs [--base origin/develop] [--json]        기준 ref 이후 바뀐 파일로 판정
//   git diff --name-only A...B | node scripts/visual-scope.mjs --files-from -   바뀐 파일 목록을 받아 판정
//   node scripts/visual-scope.mjs --files-from <목록> --check-pr --title "<PR 제목>" --body-file <본문 파일>
//     판정이 필요한 PR인데 본문의 "## 화면 판정" 절이 없거나 모자라면 1로 끝난다(CI가 쓴다)
// - 대상: frontend/src 아래 실행 코드, 스타일, 에셋, 라우트와 번들, 로딩에 닿는 설정(webpack, package.json 의존성, index.html, public).
// - 제외: 테스트, 스토리, 타입 선언, MSW 목, 문서, CI, 스크립트만 바뀐 경우.
// - 바뀐 파일을 import하는 파일을 거슬러 올라가 라우트 화면까지 닿는지 보고, 갈 수 있는 화면 목록(reachable-routes.mjs)과 겹치는 것만 낸다.
// - 설정이 바뀌었거나 앱 입구(main.tsx, App.tsx, 라우터)에서 바로 쓰는 파일이 바뀌면 범위를 좁히지 못하므로 주요 화면 전체다.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { classifyRoutes } from './reachable-routes.mjs';

const frontendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(frontendDir, '..');
const srcDir = join(frontendDir, 'src');
const appRoutesFile = join(srcDir, 'app/router/AppRoutes.tsx');
const entryFiles = ['main.tsx', 'App.tsx', 'app/App.tsx'].map((file) => join(srcDir, file));

const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();

// 사용자 화면에 실리지 않는 소스다. MSW 목(app/mocks)은 개발과 검증에서만 돈다.
export const isNonRuntimeSource = (file) =>
  /\.(test|spec|stories)\.[cm]?[jt]sx?$/.test(file) ||
  /\.d\.ts$/.test(file) ||
  /\/__tests__\//.test(file) ||
  /(^|\/)src\/app\/mocks\//.test(file);

const dependenciesChanged = (base) => {
  const read = (text) => {
    const json = JSON.parse(text);
    return JSON.stringify([json.dependencies, json.devDependencies, json.overrides, json.engines]);
  };
  try {
    return (
      read(git('show', `${base}:frontend/package.json`)) !==
      read(readFileSync(join(frontendDir, 'package.json'), 'utf8'))
    );
  } catch {
    return true;
  }
};

// 바뀐 파일을 "실행 코드", "번들 설정", "대상 아님"으로 나눈다.
export const classifyChangedFiles = (files, { packageDependenciesChanged = true } = {}) => {
  const runtime = [];
  const config = [];
  const ignored = [];
  for (const file of files) {
    if (file.startsWith('frontend/src/') && !isNonRuntimeSource(file)) runtime.push(file);
    else if (/^frontend\/(webpack\/|public\/|index\.html$|package-lock\.json$)/.test(file)) config.push(file);
    else if (file === 'frontend/package.json' && packageDependenciesChanged) config.push(file);
    else ignored.push(file);
  }
  return { runtime, config, ignored };
};

const listSourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) && !isNonRuntimeSource(path) ? [path] : [];
  });

const resolveImport = (fromFile, specifier) => {
  let base;
  if (specifier.startsWith('@/')) base = join(srcDir, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return undefined;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
};

// 파일 -> 그 파일을 import하는 파일들.
const buildImporters = () => {
  const importers = new Map();
  for (const file of listSourceFiles(srcDir)) {
    if (file.endsWith('.css')) continue;
    const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);
    for (const { fileName } of importedFiles) {
      const target = resolveImport(file, fileName);
      if (!target) continue;
      if (!importers.has(target)) importers.set(target, new Set());
      importers.get(target).add(file);
    }
  }
  return importers;
};

// 바뀐 파일에서 import한 쪽으로 거슬러 올라간다. stopAt 파일은 넣되 그 위로는 올라가지 않는다.
const collectAffected = (changed, importers, stopAt) => {
  const affected = new Set(changed);
  const queue = [...changed];
  while (queue.length > 0) {
    const file = queue.shift();
    if (stopAt.has(file)) continue;
    for (const importer of importers.get(file) ?? []) {
      if (affected.has(importer)) continue;
      affected.add(importer);
      queue.push(importer);
    }
  }
  return affected;
};

// AppRoutes.tsx에서 라우트 경로마다 그 화면을 그리는 컴포넌트 파일(위 레이아웃 라우트 포함)을 모은다.
const routeElementFiles = () => {
  const source = ts.createSourceFile(
    appRoutesFile,
    readFileSync(appRoutesFile, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const componentFiles = new Map();
  const localComponents = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const file = resolveImport(appRoutesFile, statement.moduleSpecifier.text);
      if (!file) continue;
      if (statement.importClause.name) componentFiles.set(statement.importClause.name.text, file);
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        bindings.elements.forEach((element) => componentFiles.set(element.name.text, file));
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText();
        const text = declaration.initializer?.getText() ?? '';
        const lazyImport = /^lazy\(\(\) => import\('([^']+)'\)\)$/.exec(text);
        if (lazyImport) componentFiles.set(name, resolveImport(appRoutesFile, lazyImport[1]));
        else if (declaration.initializer) localComponents.set(name, declaration.initializer);
      }
    }
  }
  const tagsIn = (node, seen = new Set()) => {
    const tags = [];
    const visit = (child) => {
      if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
        const tag = child.tagName.getText();
        if (localComponents.has(tag) && !seen.has(tag)) {
          seen.add(tag);
          tags.push(...tagsIn(localComponents.get(tag), seen));
        } else tags.push(tag);
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
    return tags;
  };
  const filesOf = (tags) => tags.map((tag) => componentFiles.get(tag)).filter(Boolean);
  const routes = [];
  const visit = (node, parentFiles) => {
    const isRoute =
      (ts.isJsxElement(node)
        ? node.openingElement.tagName.getText()
        : ts.isJsxSelfClosingElement(node)
          ? node.tagName.getText()
          : '') === 'Route';
    if (!isRoute) {
      ts.forEachChild(node, (child) => visit(child, parentFiles));
      return;
    }
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const attr = (name) =>
      opening.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText() === name);
    const element = attr('element');
    const files = [...parentFiles, ...(element?.initializer ? filesOf(tagsIn(element.initializer)) : [])];
    const path = attr('path');
    if (path) {
      const expression = ts.isJsxExpression(path.initializer) ? path.initializer.expression : path.initializer;
      routes.push({ symbol: expression.getText(), files });
    }
    if (ts.isJsxElement(node)) node.children.forEach((child) => visit(child, files));
  };
  visit(source, []);
  return routes;
};

// 바뀐 파일 목록으로 화면 판정이 필요한지와 판정할 라우트(갈 수 있는 화면 목록과 겹치는 것)를 정한다.
export const findVisualScope = async (changed, { packageDependenciesChanged = true } = {}) => {
  const { runtime, config, ignored } = classifyChangedFiles(changed, { packageDependenciesChanged });
  const classified = await classifyRoutes();
  const isReachable = (route) => (route.kind === 'reachable' || route.kind === 'exception') && route.path !== '*';
  const reachable = classified.filter(isReachable);
  if (runtime.length === 0 && config.length === 0) {
    return {
      runs: false,
      scope: 'none',
      why: '실행되는 프론트 코드와 번들 설정이 바뀌지 않았다',
      changed,
      ignored,
      routes: [],
    };
  }
  const all = { runs: true, changed, runtime, config, ignored, routes: reachable.map((route) => route.path) };
  if (config.length > 0) return { ...all, scope: 'all', why: `번들, 로딩 설정이 바뀌었다: ${config.join(', ')}` };

  // 지운 파일은 import 관계를 볼 수 없다. 그 파일을 쓰던 곳도 같이 바뀌었을 것이니 남은 바뀐 파일로 고른다.
  const changedFiles = runtime.map((file) => join(repoRoot, file)).filter((file) => existsSync(file));
  if (changedFiles.includes(appRoutesFile)) return { ...all, scope: 'all', why: '라우터 정의가 바뀌었다' };
  const affected = collectAffected(changedFiles, buildImporters(), new Set([appRoutesFile]));
  const entryHit = entryFiles.find((file) => affected.has(file));
  if (entryHit) return { ...all, scope: 'all', why: `앱 입구(${relative(srcDir, entryHit)})가 쓰는 파일이 바뀌었다` };

  // 두 스크립트가 AppRoutes.tsx의 path 있는 Route를 같은 순서로 읽으므로 순서로 짝짓는다.
  const elementRoutes = routeElementFiles();
  if (
    elementRoutes.length !== classified.length ||
    elementRoutes.some((route, index) => route.symbol !== classified[index].symbol)
  ) {
    throw new Error(
      'AppRoutes.tsx를 두 스크립트가 다르게 읽었다. reachable-routes.mjs와 visual-scope.mjs의 Route 읽기를 맞춘다.',
    );
  }
  const picked = new Set();
  elementRoutes.forEach((route, index) => {
    if (isReachable(classified[index]) && route.files.some((file) => affected.has(file)))
      picked.add(classified[index].path);
  });
  return { ...all, scope: 'routes', routes: [...picked], why: '바뀐 파일을 import하는 화면만 골랐다' };
};

export const changedFilesSince = (base) => {
  const mergeBase = git('merge-base', base, 'HEAD');
  const changed = [
    ...git('diff', '--name-only', mergeBase).split('\n'),
    ...git('ls-files', '--others', '--exclude-standard').split('\n'),
  ];
  return { mergeBase, changed: [...new Set(changed)].filter(Boolean) };
};

export const VERDICT_HEADING = '## 화면 판정';
export const VERDICTS = ['같음', '좋아짐', '나빠짐'];

// PR 본문의 "## 화면 판정" 절을 읽는다. 절은 다음 줄로 쓴다(순서 무관).
//   - 결과: 같음 | 좋아짐 | 나빠짐
//   - 영향 라우트: /, /properties/:propertyId   (범위가 전체면 "주요 화면 전체")
//   - 증거: https://... (verdict.md, 나란히 보기 그림 등 링크)
export const readVerdictSection = (body) => {
  const lines = (body ?? '').replace(/\r/g, '').split('\n');
  const start = lines.findIndex((line) => line.trim() === VERDICT_HEADING);
  if (start === -1) return undefined;
  const end = lines.findIndex((line, index) => index > start && /^#{1,2} /.test(line));
  const section = lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
  const field = (name) => new RegExp(`^\\s*[-*]\\s*${name}\\s*:\\s*(.+)$`, 'm').exec(section)?.[1].trim();
  return { result: field('결과'), routes: field('영향 라우트'), evidence: field('증거'), text: section };
};

// 판정이 필요한 PR의 본문이 판정 절을 갖췄는지 본다. 고칠 것을 한 줄씩 돌려준다(빈 배열이면 통과).
export const checkPrBody = ({ scope, title, body }) => {
  if (!scope.runs) return [];
  const section = readVerdictSection(body);
  if (!section) return [`실행되는 프론트 코드가 바뀐 PR이다(${scope.why}). 본문에 "${VERDICT_HEADING}" 절을 쓴다.`];
  const problems = [];
  if (!VERDICTS.includes(section.result ?? '')) problems.push(`"- 결과:" 줄은 ${VERDICTS.join(', ')} 중 하나다.`);
  if (!section.evidence || !/https?:\/\//.test(section.evidence))
    problems.push('"- 증거:" 줄에 증거 링크(http로 시작)를 단다.');
  if (!section.routes) problems.push('"- 영향 라우트:" 줄을 쓴다.');
  else if (scope.scope === 'all' && !section.routes.includes('주요 화면 전체')) {
    problems.push(`범위를 좁힐 수 없는 변경이다(${scope.why}). "- 영향 라우트: 주요 화면 전체"로 쓴다.`);
  } else if (scope.scope === 'routes') {
    const missing = scope.routes.filter((route) => !section.routes.split(/[,\s]+/).includes(route));
    if (missing.length > 0) problems.push(`영향 라우트에 빠진 화면이 있다: ${missing.join(', ')}`);
  }
  if (section.result === '나빠짐') problems.push('판정이 "나빠짐"이다. 고친 뒤 다시 잰다.');
  if (/\[Refactor\]/i.test(title ?? '') && section.result !== '같음') {
    problems.push('리팩터링 PR은 판정이 "같음"이어야 한다.');
  }
  return problems;
};

// PR 본문에 붙일 "## 화면 판정" 절의 빈 틀. 결과와 증거는 verify-jachwi 스킬로 로컬에서 판정한 뒤 채운다.
export const renderVerdictTemplate = (scope) => {
  if (!scope.runs) return `화면 판정 필요 없음(${scope.why}).`;
  const routes = scope.scope === 'all' ? '주요 화면 전체' : scope.routes.join(', ');
  return [
    `화면 판정이 필요하다(${scope.why}). 볼 화면: ${routes}`,
    '.claude/skills/verify-jachwi 의 "전후 판정"으로 로컬에서 재고, 아래 절을 채워 PR 본문에 붙인다.',
    '',
    VERDICT_HEADING,
    '',
    '- 결과: (같음, 좋아짐, 나빠짐 중 하나)',
    `- 영향 라우트: ${routes}`,
    '- 증거: (verdict.md와 같은 시각 나란히 보기 그림 링크)',
  ].join('\n');
};

const readArg = (args, name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const main = async () => {
  const args = process.argv.slice(2);
  const filesFrom = readArg(args, '--files-from');
  const base = readArg(args, '--base') ?? process.env.VERIFY_BASE ?? 'origin/develop';
  let changed;
  let packageDependenciesChanged = true;
  if (filesFrom) {
    changed = readFileSync(filesFrom === '-' ? 0 : filesFrom, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (changed.includes('frontend/package.json')) packageDependenciesChanged = dependenciesChanged(base);
  } else {
    const since = changedFilesSince(base);
    changed = since.changed;
    packageDependenciesChanged = dependenciesChanged(since.mergeBase);
  }
  const scope = await findVisualScope(changed, { packageDependenciesChanged });

  if (args.includes('--check-pr')) {
    const bodyFile = readArg(args, '--body-file');
    const body = bodyFile ? readFileSync(bodyFile, 'utf8') : '';
    const problems = checkPrBody({ scope, title: readArg(args, '--title') ?? '', body });
    console.log(
      scope.runs
        ? `화면 판정이 필요한 PR이다(${scope.why}). 영향 라우트: ${scope.scope === 'all' ? '주요 화면 전체' : scope.routes.join(', ')}`
        : `화면 판정 대상이 아니다(${scope.why}).`,
    );
    problems.forEach((problem) => console.error(`실패: ${problem}`));
    if (problems.length > 0) process.exitCode = 1;
    return;
  }
  if (args.includes('--template')) {
    console.log(renderVerdictTemplate(scope));
    return;
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(scope, null, 2));
    return;
  }
  if (!scope.runs) {
    console.log(`화면 판정 대상이 아니다(${scope.why}).`);
    return;
  }
  console.log(`화면 판정 대상이다. 범위: ${scope.scope === 'all' ? '주요 화면 전체' : '고른 화면'} (${scope.why})`);
  scope.routes.forEach((route) => console.log(route));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
