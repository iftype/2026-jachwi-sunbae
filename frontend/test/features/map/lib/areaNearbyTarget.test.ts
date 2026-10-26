import { expect, it } from 'vitest';

import { areaNearbyPath, readAreaNearbyBackPath, readAreaNearbyTarget } from '@/features/map/lib/areaNearbyTarget';

it('동네 좌표와 돌아갈 경로를 주변 분석 주소로 만들고 다시 읽는다', () => {
  const path = areaNearbyPath(
    '/explore',
    { name: '역삼1동', latitude: 37.5006, longitude: 127.0364 },
    '/explore/commute/areas/11230640?mode=commute',
  );
  const params = new URL(path, 'http://localhost').searchParams;
  expect(path.startsWith('/explore/nearby?')).toBe(true);
  expect(readAreaNearbyTarget(params)).toEqual({ name: '역삼1동', latitude: 37.5006, longitude: 127.0364 });
  expect(readAreaNearbyBackPath(params)).toBe('/explore/commute/areas/11230640?mode=commute');
});

it('좌표가 없거나 범위를 벗어나면 대상을 만들지 않는다', () => {
  expect(readAreaNearbyTarget(new URLSearchParams('latitude=37.5'))).toBeNull();
  expect(readAreaNearbyTarget(new URLSearchParams('latitude=abc&longitude=127'))).toBeNull();
  expect(readAreaNearbyTarget(new URLSearchParams('latitude=91&longitude=127'))).toBeNull();
});

it('이름이 없으면 기본 이름을 쓰고 외부 주소로는 돌아가지 않는다', () => {
  const params = new URLSearchParams('latitude=37.5&longitude=127&backTo=//evil.example');
  expect(readAreaNearbyTarget(params)?.name).toBe('선택한 동네');
  expect(readAreaNearbyBackPath(params)).toBe('/explore');
  expect(readAreaNearbyBackPath(new URLSearchParams('backTo=https://evil.example'))).toBe('/explore');
});
