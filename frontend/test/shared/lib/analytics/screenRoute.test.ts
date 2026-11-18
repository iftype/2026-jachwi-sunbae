import { describe, expect, it } from 'vitest';

import { getAnalyticsScreenRoute, UNKNOWN_SCREEN_ROUTE } from '@/shared/lib/analytics/screenRoute';

describe('분석용 화면 경로', () => {
  it.each([
    ['/', '/'],
    ['/', '/'],
    ['/properties/12', '/properties/:propertyId'],
    ['/properties/12/memo', '/properties/:propertyId/memo'],
    ['/properties/12/checklists/34', '/properties/:propertyId/checklists/:propertyChecklistId'],
    ['/properties/12/active-checklists/contract', '/properties/:propertyId/active-checklists/:stage'],
    ['/neighborhoods/areas/1168064000', '/neighborhoods/areas/:adminDongCode'],
    ['/explore/areas/1168064000/details', '/explore/areas/:adminDongCode/details'],
    ['/explore/nearby', '/explore/nearby'],
    ['/cheap-meals/restaurant', '/cheap-meals/:mealTab'],
    ['/me/', '/me'],
  ])('%s를 라우트 패턴 %s로 바꾼다', (pathname, route) => {
    expect(getAnalyticsScreenRoute(pathname)).toBe(route);
  });

  it('라우터에 없는 주소는 입력한 문자열 대신 한 값으로 묶는다', () => {
    expect(getAnalyticsScreenRoute('/someone@example.com')).toBe(UNKNOWN_SCREEN_ROUTE);
    expect(getAnalyticsScreenRoute('/properties/12/unknown')).toBe(UNKNOWN_SCREEN_ROUTE);
  });
});
