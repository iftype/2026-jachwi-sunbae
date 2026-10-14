import { afterEach, expect, it, vi } from 'vitest';

import { naverEngine } from '@/features/map/lib/naverMapEngine';

const previous = Object.getOwnPropertyDescriptor(window, 'naver');
afterEach(() => {
  if (previous) Object.defineProperty(window, 'naver', previous);
  else delete window.naver;
  document.querySelector('script[data-jachwi-naver-map]')?.remove();
});
const mockSdk = () => {
  const Map = vi.fn(function (_container: HTMLElement, _options: Record<string, unknown>) {
    return {};
  });
  Object.defineProperty(window, 'naver', {
    configurable: true,
    value: {
      maps: {
        Map,
        LatLng: class {
          constructor(
            public latitude: number,
            public longitude: number,
          ) {}
        },
        LatLngBounds: class {},
      },
    },
  });
  return Map;
};
it('스타일을 지정한 지도만 GL과 스타일 ID를 사용한다', () => {
  const Map = mockSdk();
  naverEngine('test', 'dark-style').createMap(document.createElement('div'), { latitude: 37.5, longitude: 127 }, 6);
  expect(Map.mock.calls[0][1]).toMatchObject({ gl: true, customStyleId: 'dark-style', zoom: 14 });
});
it('기존 지도는 GL과 스타일 옵션 없이 생성한다', () => {
  const Map = mockSdk();
  naverEngine('test').createMap(document.createElement('div'), { latitude: 37.5, longitude: 127 }, 6);
  expect(Map.mock.calls[0][1]).not.toHaveProperty('gl');
  expect(Map.mock.calls[0][1]).not.toHaveProperty('customStyleId');
});
it('SDK 로딩 주소에는 GL 서브모듈이 포함된다', async () => {
  delete window.naver;
  const loading = naverEngine('test').load();
  const script = document.querySelector<HTMLScriptElement>('script[data-jachwi-naver-map]');
  expect(script).not.toBeNull();
  expect(new URL(script!.src).searchParams.get('submodules')).toBe('gl');
  mockSdk();
  script!.dispatchEvent(new Event('load'));
  await loading;
});
