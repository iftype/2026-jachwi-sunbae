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
it('애니메이션 이동은 중심과 확대율을 함께 곡선 전환한다', () => {
  mockSdk();
  const engine = naverEngine('test');
  const map = engine.createMap(document.createElement('div'), { latitude: 37.5, longitude: 127 }, 10);
  map.morph = vi.fn();
  const point = engine.latLng(37.4, 127.1);
  engine.animateView(map, point, 6);
  expect(map.morph).toHaveBeenCalledWith(point, 14, { duration: 180, easing: 'easeOutCubic' });
});
it('SDK 로딩 주소에는 GL 서브모듈이 포함된다', async () => {
  delete window.naver;
  const loading = naverEngine('test').load();
  const script = document.querySelector<HTMLScriptElement>('script[data-jachwi-naver-map]');
  expect(script).not.toBeNull();
  expect(new URL(script!.src).searchParams.get('submodules')).toBe('gl');
  mockSdk();
  const finished = vi.fn();
  void loading.then(finished);
  script!.dispatchEvent(new Event('load'));
  await Promise.resolve();
  expect(finished).not.toHaveBeenCalled();
  expect(new URL(script!.src).searchParams.get('callback')).toBe('jachwiNaverSdkReady');
  window.jachwiNaverSdkReady?.();
  await loading;
});

it('ready 이후 인증 실패가 도착하면 다음 지도 로드를 거절한다', async () => {
  vi.resetModules();
  const { naverEngine: isolatedEngine } = await import('@/features/map/lib/naverMapEngine');
  delete window.naver;
  const loading = isolatedEngine('test').load();
  mockSdk();
  window.jachwiNaverSdkReady?.();
  await loading;
  window.navermap_authFailure?.();
  await expect(isolatedEngine('test').load()).rejects.toThrow('인증에 실패');
});

const isolatedModule = async () => {
  vi.resetModules();
  delete window.naver;
  return import('@/features/map/lib/naverMapEngine');
};
const scripts = () => document.querySelectorAll('script[data-jachwi-naver-map]');
const preloads = () => [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="script"]')];
afterEach(() => preloads().forEach((link) => link.remove()));

it('미리 받기는 SDK 두 파일을 받기만 하고 실행은 지도를 그릴 때 한다', async () => {
  const { naverEngine: isolatedEngine, preloadNaverSdk } = await isolatedModule();
  preloadNaverSdk('test');
  expect(preloads().map((link) => link.href)).toEqual([
    'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=test&submodules=gl&callback=jachwiNaverSdkReady',
    'https://oapi.map.naver.com/openapi/v3/maps-gl.js',
  ]);
  expect(scripts()).toHaveLength(0);
  void isolatedEngine('test').load();
  // 지도가 붙이는 스크립트는 미리 받은 주소와 같아야 받아 둔 응답을 쓴다.
  expect(scripts()[0].getAttribute('src')).toBe(preloads()[0].href);
});

it('미리 받기를 여러 번 불러도 링크는 한 번만 넣는다', async () => {
  const { preloadNaverSdk } = await isolatedModule();
  preloadNaverSdk('test');
  preloadNaverSdk('test');
  expect(preloads()).toHaveLength(2);
});

it('Client ID가 없거나 SDK를 이미 받았으면 미리 받지 않는다', async () => {
  const { preloadNaverSdk } = await isolatedModule();
  preloadNaverSdk('');
  expect(preloads()).toHaveLength(0);
  mockSdk();
  preloadNaverSdk('test');
  expect(preloads()).toHaveLength(0);
});
