// 앱 안에서 링크로 들어올 수 있는 라우트 목록을 만든다. 교정 기록(docs/agent-corrections.md)의 "갈 수 없는 화면" 검사다.
// 라우터 정의(AppRoutes.tsx)의 각 라우트마다, 그 주소를 만드는 상수나 함수가 앱 코드에서 링크나 이동에 쓰였는지 찾는다.
// 사용법(frontend 폴더에서):
//   node scripts/reachable-routes.mjs                 들어올 수 있는 라우트 패턴을 한 줄씩 출력한다(밖에서 들어오는 예외 포함)
//   node scripts/reachable-routes.mjs --json          전체 분류를 JSON으로 출력한다
//   node scripts/reachable-routes.mjs --check <경로>  그 경로가 들어올 수 있는 화면이 아니면 1로 끝난다(녹화와 검증 전에 쓴다)
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const frontendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(frontendDir, 'src');
const appRoutesFile = join(srcDir, 'app/router/AppRoutes.tsx');
const appPathsFile = join(srcDir, 'shared/lib/navigation/appPaths.ts');

// 경로 상수 하나로는 링크를 찾을 수 없는 라우트다. 그 라우트로 보내는 생성 함수나 다른 상수를 적는다.
export const linkSymbols = {
  '/': ['HOME_PATH', 'RECORDS_PATH', 'RECORDS_MAP_PATH'],
  '/explore/areas/:adminDongCode': ['neighborhoodAreaPath'],
  '/explore/areas/:adminDongCode/details': ['neighborhoodAreaDetailsPath'],
  '/neighborhoods/areas/:adminDongCode': ['neighborhoodAreaPath'],
  '/neighborhoods/areas/:adminDongCode/details': ['neighborhoodAreaDetailsPath'],
  '/cheap-meals/:mealTab?': ['CHEAP_MEALS_PATH', 'cheapMealsTabPath'],
  '/properties/:propertyId': ['propertyDetailPath', 'propertyChecklistTabPath'],
  '/properties/:propertyId/active-checklists/:stage': ['propertyActiveChecklistPath'],
  '/properties/:propertyId/edit': ['propertyEditPath'],
  '/properties/:propertyId/photos': ['propertyPhotosPath'],
  '/properties/:propertyId/checklists/:propertyChecklistId': ['propertyChecklistPath'],
  '/checklists/new': ['CHECKLIST_CREATE_PATH', 'propertyChecklistCreatePath'],
  '/checklists/:checklistId': ['checklistDetailPath'],
  '/search': ['ADDRESS_SEARCH_PATH', 'NEIGHBORHOOD_ADDRESS_SEARCH_PATH'],
};

// 앱 안 링크 없이 들어오는 것이 맞는 라우트와 그 이유다. 새 항목은 이유가 분명할 때만 더한다.
export const entryExceptions = {
  '/admin/*': '관리자 화면이다. 운영자가 주소를 직접 쳐서 들어간다.',
  '/explore': '광고와 외부 공유 링크로 밖에서 들어오는 공개 탐색 화면이다.',
  '/landing': '광고 랜딩이다. 앱 안 링크(홈 바닥글)도 있지만 밖에서 들어오는 것이 주된 입구다.',
  '/oauth/complete': 'OAuth 콜백 뒤 서버가 303으로 보내는 주소다.',
  '*': '없는 주소를 받는 404 화면이다.',
};

// 경로 상수가 링크로 쓰이지 않는 파일이다. 주소를 비교하거나 분석 이름을 붙일 뿐이다.
const nonLinkFiles = new Set([
  'app/router/AppRoutes.tsx',
  'shared/lib/navigation/appPaths.ts',
  'shared/lib/analytics/screenRoute.ts',
  'shared/lib/analytics/adminPrivacy.ts',
]);

const routeAttr = (element, name) =>
  element.attributes.properties.find((attr) => ts.isJsxAttribute(attr) && attr.name.getText() === name);

const jsxTagName = (node) => {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText();
  return undefined;
};

const firstJsxIn = (node) => {
  if (jsxTagName(node)) return node;
  return ts.forEachChild(node, firstJsxIn);
};

const evaluatePath = (expression, values) => {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (ts.isIdentifier(expression)) return values[expression.text];
  if (ts.isPropertyAccessExpression(expression) && expression.expression.getText() === 'ROUTE_PATTERNS') {
    return values.ROUTE_PATTERNS[expression.name.text];
  }
  if (ts.isTemplateExpression(expression)) {
    return (
      expression.head.text +
      expression.templateSpans.map((span) => evaluatePath(span.expression, values) + span.literal.text).join('')
    );
  }
  throw new Error(`AppRoutes.tsx의 path 식을 읽지 못했다: ${expression.getText()}`);
};

const joinPath = (parent, child) => {
  if (child.startsWith('/') || child === '*') return child;
  return `${parent === '/' ? '' : parent}/${child}`;
};

const collectRoutes = (values) => {
  const source = ts.createSourceFile(
    appRoutesFile,
    readFileSync(appRoutesFile, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const routes = [];
  const visit = (node, parentPath) => {
    const tag = jsxTagName(node);
    if (tag !== 'Route') {
      ts.forEachChild(node, (child) => visit(child, parentPath));
      return;
    }
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const pathAttr = routeAttr(opening, 'path');
    let fullPath = parentPath;
    if (pathAttr?.initializer) {
      const expression = ts.isJsxExpression(pathAttr.initializer)
        ? pathAttr.initializer.expression
        : pathAttr.initializer;
      fullPath = joinPath(parentPath, evaluatePath(expression, values));
      const elementAttr = routeAttr(opening, 'element');
      const elementJsx = elementAttr?.initializer ? firstJsxIn(elementAttr.initializer) : undefined;
      const elementTag = elementJsx ? jsxTagName(elementJsx) : undefined;
      const isRedirect = elementTag === 'Navigate' || /^Legacy/.test(elementTag ?? '');
      routes.push({ path: fullPath, symbol: expression.getText(), isRedirect });
    }
    if (ts.isJsxElement(node)) node.children.forEach((child) => visit(child, fullPath));
  };
  visit(source, '');
  return routes;
};

const listSourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    if (!/\.tsx?$/.test(entry.name) || /\.(test|stories)\.tsx?$/.test(entry.name)) return [];
    return [path];
  });

// 링크로 쓴 줄만 센다. import 줄과, 지금 주소와 견주는 줄(pathname, startsWith, matchPath)은 링크가 아니다.
const linkUses = (symbol, files) => {
  const word = new RegExp(`\\b${symbol}\\b`);
  return files.flatMap(({ file, lines }) =>
    lines
      .map((line, index) => ({ line, index }))
      .filter(
        ({ line }) =>
          word.test(line) &&
          !/^\s*(import\b|(type\s+)?[A-Za-z_]+,\s*$)/.test(line) &&
          !/pathname|startsWith|matchPath/.test(line),
      )
      .map(({ index }) => `${file}:${index + 1}`),
  );
};

// 앱 안에서 갈 수 없는 것을 알고 남겨 둔 라우트다. 이 목록은 줄기만 해야 한다(scripts/reachable-routes.test.mjs가 개수 상한을 지킨다).
// 링크를 만들거나 라우트를 지우면 여기서 뺀다. 갈 수 없는 화면은 검증 증거로 쓰지 않는다(--check가 실패한다).
export const knownUnreachable = {
  '/explore/nearby': '주변 분석 화면. 들어오는 링크가 없다. 지우는 작업이 refactor/remove-ai-slop-finder-map에 있다.',
  '/neighborhoods/nearby': '위와 같은 주변 분석 화면의 로그인 주소다.',
  '/properties/:propertyId/memo': '매물 메모 화면. 상세 화면 안 메모로 옮긴 뒤 들어오는 링크가 없다.',
  '/properties/:propertyId/nearby': '매물 주변 분석 화면. 들어오는 링크가 없다.',
};

// appPaths.ts를 자바스크립트로 바꿔 값만 읽는다. Node의 타입 지우기나 번들러 없이 돈다.
const readAppPaths = () => {
  const { outputText } = ts.transpileModule(readFileSync(appPathsFile, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function('module', 'exports', outputText)(module, module.exports);
  return module.exports;
};

export const classifyRoutes = async () => {
  const values = readAppPaths();
  const files = listSourceFiles(srcDir)
    .map((path) => ({ file: relative(srcDir, path), path }))
    .filter(({ file }) => !nonLinkFiles.has(file))
    .map(({ file, path }) => ({ file, lines: readFileSync(path, 'utf8').split('\n') }));
  return collectRoutes(values).map((route) => {
    if (route.isRedirect) return { ...route, kind: 'redirect', links: [] };
    if (route.path in entryExceptions) {
      return { ...route, kind: 'exception', reason: entryExceptions[route.path], links: [] };
    }
    const symbols = linkSymbols[route.path] ?? (/^[A-Z_]+$/.test(route.symbol) ? [route.symbol] : []);
    const links = symbols.flatMap((symbol) => linkUses(symbol, files));
    if (links.length > 0) return { ...route, kind: 'reachable', symbols, links };
    if (route.path in knownUnreachable) {
      return { ...route, kind: 'known-unreachable', reason: knownUnreachable[route.path], symbols, links };
    }
    return { ...route, kind: 'unreachable', symbols, links };
  });
};

const toPattern = (routePath) =>
  new RegExp(
    `^${routePath
      .replace(/[.+^$()|[\]\\]/g, '\\$&')
      .replace(/\/:[A-Za-z]+\?/g, '(?:/[^/]+)?')
      .replace(/:[A-Za-z]+/g, '[^/]+')
      .replace(/\/\*$/, '(?:/.*)?')}/?$`,
  );

export const findReachableRoute = (routes, url) => {
  const pathname = new URL(url, 'http://localhost').pathname;
  // 없는 주소를 받는 404(`*`)는 어느 주소에나 맞으므로 견주지 않는다.
  return routes.find(
    (route) => route.kind !== 'redirect' && route.path !== '*' && toPattern(route.path).test(pathname),
  );
};

const main = async () => {
  const routes = await classifyRoutes();
  const [flag, target] = process.argv.slice(2);
  if (flag === '--json') {
    console.log(JSON.stringify(routes, null, 2));
    return;
  }
  if (flag === '--check') {
    const route = target ? findReachableRoute(routes, target) : undefined;
    if (route?.kind === 'reachable' || route?.kind === 'exception') {
      console.log(`${target}: ${route.path} (${route.kind === 'reachable' ? route.links[0] : route.reason})`);
      return;
    }
    console.error(
      `${target}: 앱 안에서 들어올 수 없는 화면이라 증거로 쓰지 않는다. 사용자가 실제로 들어오는 화면에서 다시 찍거나, 이 화면으로 들어오는 링크부터 만든다.`,
    );
    process.exitCode = 1;
    return;
  }
  routes
    .filter((route) => (route.kind === 'reachable' || route.kind === 'exception') && route.path !== '*')
    .forEach((route) => console.log(route.path));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
