import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMapRegionLayer, regionAtLevel } from '@/features/map/lib/mapRegionLayer';
import type { MapRegion } from '@/features/map/model/MapCanvas';

it('앱 축척 8 이상은 overview, 5~7은 medium, 4 이하는 원본을 고른다', () => {
  const original = [[[{ latitude: 37, longitude: 127 }]]];
  const overview = [[[{ latitude: 37.1, longitude: 127 }]]];
  const medium = [[[{ latitude: 37.2, longitude: 127 }]]];
  const region: MapRegion = {
    id: 'a',
    name: '동',
    paths: [],
    polygons: original,
    simplifiedPolygons: { overview, medium },
  };
  expect(regionAtLevel(region, 10).polygons).toBe(overview);
  expect(regionAtLevel(region, 8).polygons).toBe(overview);
  expect(regionAtLevel(region, 7).polygons).toBe(medium);
  expect(regionAtLevel(region, 5).polygons).toBe(medium);
  expect(regionAtLevel(region, 4).polygons).toBe(original);
  expect(regionAtLevel({ ...region, simplifiedPolygons: undefined }, 10).polygons).toBe(original);
});

type Point = { latitude: number; longitude: number };
type Listener = { target: unknown; event: string; callback: () => void };

/** 실제 SDK 대신 생성자 옵션과 호출만 기록한다. */
const setup = ({
  ready = (): boolean => true,
  center = { latitude: 37.5, longitude: 127 },
}: { ready?: () => boolean; center?: Point } = {}) => {
  const polygons: FakePolygon[] = [];
  const listeners: Listener[] = [];
  const overlays: {
    marker: { id: string; latitude: number; longitude: number };
    content: HTMLElement;
    setMap: ReturnType<typeof vi.fn>;
  }[] = [];
  class FakePolygon {
    setPaths = vi.fn();
    setOptions = vi.fn();
    setMap = vi.fn();
    constructor(
      readonly options: {
        paths: { lat: number; lng: number }[][];
        fillColor: string;
        fillOpacity: number;
        strokeColor: string;
        strokeWeight: number;
        zIndex: number;
        clickable: boolean;
      },
    ) {
      polygons.push(this);
    }
  }
  const sdk = {
    Polygon: FakePolygon,
    Event: {
      addListener: (target: unknown, event: string, callback: () => void) => {
        const listener = { target, event, callback };
        listeners.push(listener);
        return listener;
      },
    },
  } as unknown as NaverMapsNamespace;
  const engine = {
    latLng: (lat: number, lng: number) => ({ lat, lng }),
    createOverlay: vi.fn(
      (_map: unknown, marker: { id: string; latitude: number; longitude: number }, content: HTMLElement) => {
        const overlay = { marker, content, setMap: vi.fn() };
        overlays.push(overlay);
        return overlay;
      },
    ),
    removeListener: vi.fn(),
    isRenderReady: vi.fn(ready),
    getCenter: () => center,
  };
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const flush = () => {
    for (let i = 0; i < 2; i++) frames.splice(0).forEach((callback) => callback(0));
  };
  const onSelect = vi.fn();
  let level = 4;
  const layer = createMapRegionLayer({} as never, sdk, engine as never, onSelect, () => level);
  const fire = (target: unknown, event: string) =>
    listeners.filter((item) => item.target === target && item.event === event).forEach((item) => item.callback());
  return {
    layer,
    polygons,
    listeners,
    overlays,
    engine,
    flush,
    frames,
    cancel,
    onSelect,
    fire,
    setLevel: (next: number) => (level = next),
  };
};
const ring = (latitude: number, longitude = 127): Point[] => [
  { latitude, longitude },
  { latitude: latitude + 0.001, longitude },
  { latitude, longitude: longitude + 0.001 },
  { latitude, longitude },
];
const region = (id: string, extra: Partial<MapRegion> = {}): MapRegion => ({
  id,
  name: id,
  paths: [ring(37.5)],
  ...extra,
});

afterEach(() => vi.restoreAllMocks());

describe('경계 레이어', () => {
  it('색이 없는 경계는 추천·선택 여부로 기본 스타일을 정하고 클릭할 수 있다', () => {
    const { layer, polygons } = setup();
    layer.sync(
      [
        region('추천', { isRecommended: true }),
        region('비추천', { isRecommended: false }),
        region('선택', { isRecommended: false }),
      ],
      '선택',
    );
    expect(polygons[0].options).toMatchObject({
      fillColor: '#f5c344',
      fillOpacity: 0.24,
      strokeColor: '#a4a7ab',
      strokeWeight: 1,
      zIndex: 1,
      clickable: true,
    });
    expect(polygons[1].options).toMatchObject({ fillColor: '#888888', fillOpacity: 0.08 });
    expect(polygons[2].options).toMatchObject({
      fillColor: '#f5c344',
      fillOpacity: 0.5,
      strokeColor: '#787b80',
      strokeWeight: 2,
      zIndex: 2,
    });
  });

  it('같은 호버 상태는 다시 적용하지 않고 벗어나면 원래 투명도로 돌린다', () => {
    const { layer, polygons, fire } = setup();
    layer.sync([region('a', { appearance: { fillColor: '#111111', strokeColor: '#222222' } })], null);
    fire(polygons[0], 'mouseover');
    fire(polygons[0], 'mouseover');
    expect(polygons[0].setOptions).toHaveBeenCalledOnce();
    expect(polygons[0].setOptions.mock.lastCall?.[0].fillOpacity).toBeCloseTo(0.38);
    fire(polygons[0], 'mouseout');
    expect(polygons[0].setOptions).toHaveBeenLastCalledWith({ fillOpacity: 0.28 });
  });

  it('호버 중 선택 스타일이 바뀌어도 호버만큼 진한 투명도를 유지한다', () => {
    const { layer, polygons, fire } = setup();
    const regions = [region('a', { appearance: { fillColor: '#111111', strokeColor: '#222222' } })];
    layer.sync(regions, null);
    fire(polygons[0], 'mouseover');
    layer.sync(regions, 'a');
    expect(polygons[0].setOptions.mock.lastCall?.[0].fillOpacity).toBeCloseTo(0.48);
  });

  it('면 개수가 같으면 좌표만 바꾸고, 다르면 기존 경계와 리스너를 지우고 새로 만든다', () => {
    const { layer, polygons, engine } = setup();
    layer.sync([region('a')], null);
    layer.sync([region('a', { paths: [ring(37.6)] })], null);
    expect(polygons).toHaveLength(1);
    expect(polygons[0].setPaths).toHaveBeenCalledWith([
      [
        { lat: 37.6, lng: 127 },
        { lat: 37.601, lng: 127 },
        { lat: 37.6, lng: 127.001 },
        { lat: 37.6, lng: 127 },
      ],
    ]);
    layer.sync([region('a', { polygons: [[ring(37.6)], [ring(37.7)]] })], null);
    expect(polygons[0].setMap).toHaveBeenCalledWith(null);
    expect(engine.removeListener).toHaveBeenCalledTimes(3);
    expect(polygons.slice(1)).toHaveLength(2);
    expect(polygons[1].options.paths[0][0]).toEqual({ lat: 37.6, lng: 127 });
  });

  it('빈 면은 그리지 않는다', () => {
    const { layer, polygons } = setup();
    layer.sync([region('a', { polygons: [[ring(37.5)], []] })], null);
    expect(polygons).toHaveLength(1);
  });

  it('요약이 있는 동만 라벨을 만들고, 요약이 바뀔 때만 교체하며 라벨 호버·클릭을 경계와 연결한다', () => {
    const { layer, polygons, overlays, onSelect } = setup();
    const priced = region('a', {
      isRecommended: true,
      center: { latitude: 37.55, longitude: 127.05 },
      summary: { price: '50만원' },
    });
    layer.sync([priced, region('b')], null);
    expect(overlays).toHaveLength(1);
    expect(overlays[0].marker).toMatchObject({ id: 'a', latitude: 37.55, longitude: 127.05 });
    layer.sync([{ ...priced }, region('b')], null);
    expect(overlays).toHaveLength(1);
    const label = overlays[0].content;
    label.dispatchEvent(new Event('mouseenter'));
    expect(polygons[0].setOptions.mock.lastCall?.[0].fillOpacity).toBeCloseTo(0.34);
    expect(label.dataset.hovered).toBe('true');
    label.dispatchEvent(new Event('mouseleave'));
    expect(label.dataset.hovered).toBe('false');
    label.dispatchEvent(new Event('focus'));
    expect(label.dataset.hovered).toBe('true');
    label.dispatchEvent(new Event('blur'));
    expect(label.dataset.hovered).toBe('false');
    label.click();
    expect(onSelect).toHaveBeenCalledWith('a');
    layer.sync([{ ...priced, summary: { price: '60만원' } }, region('b')], null);
    expect(overlays[0].setMap).toHaveBeenCalledWith(null);
    expect(overlays).toHaveLength(2);
    layer.sync([{ ...priced, summary: undefined }, region('b')], null);
    expect(overlays[1].setMap).toHaveBeenCalledWith(null);
    expect(overlays).toHaveLength(2);
  });

  it('GL 지도가 준비되기 전에는 경계를 만들지 않고 준비되면 만든다', () => {
    let ready = false;
    const { layer, polygons, flush } = setup({ ready: () => ready });
    layer.sync([region('a')], null);
    flush();
    expect(polygons).toHaveLength(0);
    ready = true;
    flush();
    expect(polygons).toHaveLength(1);
  });

  it('준비 신호가 끝내 없어도 3초가 지나면 경계를 그린다', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { layer, polygons, flush } = setup({ ready: () => false });
    layer.sync([region('a')], null);
    now.mockReturnValue(3999);
    flush();
    expect(polygons).toHaveLength(0);
    now.mockReturnValue(4000);
    flush();
    expect(polygons).toHaveLength(1);
  });

  it('같은 단계에서는 위도에 맞춘 경도 축척으로 화면 중심에 가까운 동을 먼저 넣는다', () => {
    const { layer, polygons, flush } = setup();
    // 중심(37.5, 127)과 같은 자리의 동 38개를 먼저 채운다.
    const fillers = Array.from({ length: 38 }, (_, index) =>
      region(`f${index}`, { center: { latitude: 37.5, longitude: 127 } }),
    );
    // 경도로 0.012 떨어진 동은 축척(cos 37.5°)을 적용하면 위도로 0.01 떨어진 동보다 가깝다. 중심 좌표가 없으면 첫 면의 첫 점을 쓴다.
    const east = region('east', { polygons: [[ring(37.5, 127.012)]] });
    const north = region('north', { paths: [ring(37.51)] });
    // 위도는 거의 같지만 서쪽으로 멀리 떨어진 동은 마지막이다.
    const farWest = region('farWest', {
      center: { latitude: 37.501, longitude: 126.95 },
      paths: [ring(37.501, 126.95)],
    });
    layer.sync([farWest, north, east, ...fillers], null);
    const first = (paths: { lat: number; lng: number }[][]) => paths[0][0];
    expect(polygons).toHaveLength(40);
    const firstBatch = polygons.map((polygon) => first(polygon.options.paths));
    expect(firstBatch).toContainEqual({ lat: 37.5, lng: 127.012 });
    expect(firstBatch).toContainEqual({ lat: 37.51, lng: 127 });
    expect(firstBatch).not.toContainEqual({ lat: 37.501, lng: 126.95 });
    flush();
    expect(polygons).toHaveLength(41);
    expect(first(polygons[40].options.paths)).toEqual({ lat: 37.501, lng: 126.95 });
  });

  it('새 결과는 다시 나눠 그리고, 일부가 이미 그려진 갱신은 한 번에 반영한다', () => {
    const { layer, polygons, flush } = setup();
    const many = (prefix: string) => Array.from({ length: 41 }, (_, index) => region(`${prefix}${index}`));
    layer.sync(many('a'), null);
    flush();
    expect(polygons).toHaveLength(41);
    layer.sync([...many('a'), ...many('b')], null);
    expect(polygons).toHaveLength(82);
    layer.sync(many('c'), null);
    expect(polygons).toHaveLength(122);
    flush();
    expect(polygons).toHaveLength(123);
  });

  it('나눠 그리는 중에 결과가 바뀌거나 종료하면 예약한 다음 묶음을 취소하고 모두 정리한다', () => {
    const { layer, polygons, cancel, engine, overlays } = setup();
    layer.sync(
      [
        ...Array.from({ length: 41 }, (_, index) => region(`a${index}`)),
        region('label', { summary: { price: '1만원' } }),
      ],
      null,
    );
    layer.dispose();
    expect(cancel).toHaveBeenCalled();
    expect(polygons.every((polygon) => polygon.setMap.mock.calls.some(([value]) => value === null))).toBe(true);
    expect(engine.removeListener).toHaveBeenCalledTimes(polygons.length * 3);
    expect(overlays.every((overlay) => overlay.setMap.mock.calls.some(([value]) => value === null))).toBe(true);
  });
});
