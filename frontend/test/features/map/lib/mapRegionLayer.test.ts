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
        strokeStyle?: string;
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
      (
        _map: unknown,
        marker: { id: string; latitude: number; longitude: number },
        content: HTMLElement,
        _zIndex?: number,
      ) => {
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
      fillOpacity: 0.12,
      strokeColor: '#a4a7ab',
      strokeWeight: 1,
      zIndex: 1,
      clickable: true,
    });
    expect(polygons[1].options).toMatchObject({ fillColor: '#888888', fillOpacity: 0.05 });
    expect(polygons[2].options).toMatchObject({
      fillColor: '#f5c344',
      fillOpacity: 0.25,
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
    expect(polygons[0].setOptions.mock.lastCall?.[0].fillOpacity).toBeCloseTo(0.16);
    fire(polygons[0], 'mouseout');
    expect(polygons[0].setOptions).toHaveBeenLastCalledWith({ fillOpacity: 0.12 });
  });

  it('호버 중 선택 스타일이 바뀌어도 호버만큼 진한 투명도를 유지한다', () => {
    const { layer, polygons, fire } = setup();
    const regions = [region('a', { appearance: { fillColor: '#111111', strokeColor: '#222222' } })];
    layer.sync(regions, null);
    fire(polygons[0], 'mouseover');
    layer.sync(regions, 'a');
    expect(polygons[0].setOptions.mock.lastCall?.[0].fillOpacity).toBeCloseTo(0.29);
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
    expect(polygons[0].setOptions.mock.lastCall?.[0].fillOpacity).toBeCloseTo(0.16);
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

  it('통근 결과의 동네마다 동 이름과 월세를 함께 보여 주는 라벨을 하나씩 두고, 7단계보다 멀면 모두 거둔다', () => {
    const { layer, overlays, setLevel } = setup();
    const rentLabel = { price: null, count: 0, sparse: false, filteredOut: false, commute: '12분' };
    const regions = Array.from({ length: 20 }, (_, index) =>
      region(`dong-${index}`, { center: { latitude: 37.5, longitude: 127 + index * 0.01 }, rentLabel }),
    );
    setLevel(6);
    layer.sync(regions, null);
    expect(overlays).toHaveLength(20);
    expect(overlays.every((overlay) => overlay.content.dataset.compact === 'false')).toBe(true);
    // 이름만 보이는 이름표는 두지 않는다. 가까이서는 늘 월세와 함께 보인다.
    setLevel(7);
    layer.sync(regions, null);
    expect(overlays.every((overlay) => overlay.content.dataset.compact === 'false')).toBe(true);
    setLevel(8);
    layer.sync(regions, null);
    expect(overlays.every((overlay) => overlay.setMap.mock.calls.some(([value]) => value === null))).toBe(true);
  });

  it('휴대폰에서는 요약 카드 대신 동 이름과 통근 시간만 적은 이름표를 그리고, 누르면 그 동을 고른다', () => {
    const { layer, polygons, overlays, onSelect, fire } = setup();
    const rentLabel = { price: '55만', count: 40, sparse: false, filteredOut: false, commute: '4분' };
    const regions = [
      region('summary', { center: { latitude: 37.5, longitude: 127 }, summary: { price: '50만원' } }),
      region('삼성2동', { center: { latitude: 37.5, longitude: 127.01 }, rentLabel }),
      region('name', { center: { latitude: 37.5, longitude: 127.02 }, showsName: true }),
    ];
    layer.sync(regions, null, 'chip');
    expect(polygons).toHaveLength(3);
    expect(overlays.map((overlay) => overlay.marker.id)).toEqual(['삼성2동', 'name']);
    const chip = overlays[0].content;
    expect(chip).toHaveTextContent('삼성2동4분');
    // 월세는 글자로 적지 않고 읽기 도구 이름에만 둔다.
    expect(chip).not.toHaveTextContent('월세');
    expect(chip).toHaveAttribute('aria-label', '삼성2동 통근 4분 월세 55만, 거래 40건');
    chip.click();
    expect(onSelect).toHaveBeenCalledWith('삼성2동');
    fire(polygons[0], 'click');
    expect(onSelect).toHaveBeenCalledWith('summary', undefined);
    // 데스크탑 기준으로 다시 맞추면 요약 카드와 월세 라벨로 바꿔 그린다.
    layer.sync(regions, null, 'full');
    expect(overlays.slice(2).map((overlay) => overlay.marker.id)).toEqual(['summary', '삼성2동', 'name']);
    expect(overlays[3].content).toHaveTextContent('월세 55만');
  });

  it('휴대폰 이름표는 데스크탑과 같은 7단계부터 보이고, 고른 동은 강조해 앞에 둔다', () => {
    const { layer, overlays, engine, setLevel } = setup();
    const rentLabel = { price: null, count: 0, sparse: false, filteredOut: false, commute: '12분' };
    const regions = [region('a', { center: { latitude: 37.5, longitude: 127 }, rentLabel })];
    setLevel(8);
    layer.sync(regions, null, 'chip');
    expect(overlays).toHaveLength(0);
    setLevel(7);
    layer.sync(regions, 'a', 'chip');
    expect(overlays).toHaveLength(1);
    expect(overlays[0].content).toHaveAttribute('aria-pressed', 'true');
    expect(engine.createOverlay.mock.calls[0][3]).toBeGreaterThan(5);
  });

  it('휴대폰 이름표가 서로 겹치면 고른 동, 찜한 동, 통근이 짧은 동 순으로 남기고 나머지는 숨긴다', () => {
    const { layer, overlays, setLevel } = setup();
    const label = (commute: string, extra = {}) => ({
      price: null,
      count: 0,
      sparse: false,
      filteredOut: false,
      commute,
      ...extra,
    });
    // 경도 0.0005도는 확대 단계 6(네이버 zoom 14)에서 약 6px라 이름표가 서로 겹친다.
    const regions = [
      region('far', { center: { latitude: 37.5, longitude: 127 }, rentLabel: label('40분') }),
      region('near', { center: { latitude: 37.5, longitude: 127.0005 }, rentLabel: label('10분') }),
      region('apart', { center: { latitude: 37.5, longitude: 127.05 }, rentLabel: label('50분') }),
    ];
    setLevel(6);
    layer.sync(regions, null, 'chip');
    expect(overlays.map((overlay) => overlay.marker.id)).toEqual(['near', 'apart']);
    layer.sync(regions, 'far', 'chip');
    const shown = overlays.filter((overlay) => !overlay.setMap.mock.calls.some(([value]) => value === null));
    expect(shown.map((overlay) => overlay.marker.id).sort()).toEqual(['apart', 'far']);
    // 가까이 다가가면 떨어져 보여 모두 남는다.
    setLevel(1);
    layer.sync(regions, null, 'chip');
    const closer = overlays.filter((overlay) => !overlay.setMap.mock.calls.some(([value]) => value === null));
    expect(closer.map((overlay) => overlay.marker.id).sort()).toEqual(['apart', 'far', 'near']);
  });

  it('찜한 동네 이름표는 월세 시세가 도착하면 이름표만 새로 만들고, 휴대폰에서는 이름만 적은 이름표로 둔다', () => {
    const { layer, polygons, overlays } = setup();
    const bookmark = region('name', { center: { latitude: 37.5, longitude: 127 }, showsName: true });
    layer.sync([bookmark], null);
    expect(overlays).toHaveLength(1);
    expect(overlays[0].content.querySelector('small')).toBeNull();
    layer.sync([{ ...bookmark, nameCaption: '월세 70만' }], null);
    expect(polygons).toHaveLength(1);
    expect(overlays).toHaveLength(2);
    expect(overlays[1].content.querySelector('small')).toHaveTextContent('월세 70만');
    layer.sync([{ ...bookmark, nameCaption: '월세 70만' }], null, 'chip');
    expect(overlays).toHaveLength(3);
    expect(overlays[2].content).toHaveTextContent(/^name$/);
    expect(overlays[2].content.dataset.bookmark).toBe('true');
  });

  it('점선으로 표시하는 색(월세 정보 없음)은 테두리를 점선으로 그리고, 고르면 실선으로 강조한다', () => {
    const { layer, polygons } = setup();
    const appearance = { fillColor: '#868B94', strokeColor: '#868B94', dashed: true };
    layer.sync([region('a', { appearance }), region('b', { appearance: { ...appearance, dashed: false } })], null);
    expect(polygons[0].options).toMatchObject({ fillColor: '#868B94', fillOpacity: 0.12, strokeStyle: 'shortdash' });
    expect(polygons[1].options).toMatchObject({ strokeStyle: 'solid' });
    layer.sync([region('a', { appearance }), region('b', { appearance: { ...appearance, dashed: false } })], 'a');
    expect(polygons[0].setOptions.mock.lastCall?.[0]).toMatchObject({ strokeStyle: 'solid', fillOpacity: 0.25 });
  });
});
