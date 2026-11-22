// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';

import type { ClassifiedRoute } from '../../scripts/reachable-routes.mjs';
import { classifyRoutes, findReachableRoute, knownUnreachable } from '../../scripts/reachable-routes.mjs';

// 알고 남겨 둔 갈 수 없는 라우트 수의 상한이다. 목록은 줄기만 해야 하므로, 항목을 빼면 이 숫자도 같이 낮춘다.
const KNOWN_UNREACHABLE_LIMIT = 4;

let routes: ClassifiedRoute[] = [];

beforeAll(async () => {
  routes = await classifyRoutes();
});

describe('갈 수 있는 화면 목록', () => {
  it('모든 라우트에 앱 안에서 들어오는 길이 있다', () => {
    const unreachable = routes.filter((route) => route.kind === 'unreachable').map((route) => route.path);

    // 실패하면: 그 화면으로 가는 Link나 navigate를 만들거나 라우트를 지운다. 밖에서만 들어오는 화면이면
    // scripts/reachable-routes.mjs의 entryExceptions에 이유를 적는다. knownUnreachable에는 더하지 않는다.
    expect(unreachable).toEqual([]);
  });

  it('알고 남겨 둔 갈 수 없는 라우트는 늘지 않는다', () => {
    expect(Object.keys(knownUnreachable).length).toBeLessThanOrEqual(KNOWN_UNREACHABLE_LIMIT);
  });

  it('알고 남겨 둔 라우트는 지금도 있고 여전히 갈 수 없다', () => {
    const stale = Object.keys(knownUnreachable).filter(
      (path) => routes.find((route) => route.path === path)?.kind !== 'known-unreachable',
    );

    // 실패하면: 링크가 생겼거나 라우트가 없어진 것이다. knownUnreachable에서 빼고 상한을 낮춘다.
    expect(stale).toEqual([]);
  });

  it('검증 전 경로 확인은 실제 주소를 라우트에 맞춘다', () => {
    expect(findReachableRoute(routes, '/properties/11')?.kind).toBe('reachable');
    expect(findReachableRoute(routes, '/cheap-meals/restaurant')?.kind).toBe('reachable');
    expect(findReachableRoute(routes, '/explore')?.kind).toBe('exception');
    expect(findReachableRoute(routes, '/explore/nearby')?.kind).toBe('known-unreachable');
    expect(findReachableRoute(routes, '/no-such-screen')).toBeUndefined();
  });
});
