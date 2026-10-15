import { act, render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MapRegion } from '@/features/map/model/MapCanvas';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
  mapProviderMode: 'naver',
  naverMapClientId: 'test-key',
};

class FakeLatLng {
  constructor(
    private readonly latitude: number,
    private readonly longitude: number,
  ) {}

  lat = () => this.latitude;
  lng = () => this.longitude;
}

class FakeLatLngBounds {
  constructor(
    readonly sw: FakeLatLng,
    readonly ne: FakeLatLng,
  ) {}

  getSW = () => this.sw;
  getNE = () => this.ne;
}

const overlayInstances: FakeOverlay[] = [];

class FakeOverlay {
  setPaths = vi.fn();
  setOptions = vi.fn();
  readonly pane = document.createElement('div');
  onAdd?: () => void;
  draw?: () => void;
  onRemove?: () => void;
  setPosition = vi.fn();
  getPanes = () => ({ overlayLayer: this.pane });
  getProjection = () => ({ fromCoordToOffset: () => ({ x: 120, y: 80 }) });
  setMap = vi.fn((map: unknown) => {
    if (map === null) this.onRemove?.();
    else {
      this.onAdd?.();
      this.draw?.();
    }
  });

  constructor(readonly options?: { paths?: FakeLatLng[][] }) {
    overlayInstances.push(this);
  }
}

const renderWithConfig = (ui: ReactElement) =>
  render(ui, { wrapper: ({ children }) => <PublicConfigProvider config={config}>{children}</PublicConfigProvider> });

describe('Naver 지도 상태 동기화', () => {
  it('지도 좌표에 조회 버튼을 붙이고 제거 시 오버레이를 정리한다', async () => {
    const center = { latitude: 37.5, longitude: 127 };
    const onClick = vi.fn();
    const { rerender } = renderWithConfig(
      <MapCanvas center={center} coordinateAction={{ ...center, label: '조회', onClick }} />,
    );
    await waitFor(() => expect(overlayInstances).toHaveLength(1));
    const button = overlayInstances[0].pane.querySelector('button');
    expect(button?.textContent).toBe('조회');
    act(() => button?.click());
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<MapCanvas center={center} />);
    expect(overlayInstances[0].setMap).toHaveBeenCalledWith(null);
  });
  type FakeMapInstance = {
    center: FakeLatLng;
    zoom: number;
    getCenter: () => FakeLatLng;
    getZoom: () => number;
    setCenter: ReturnType<typeof vi.fn>;
    setZoom: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    autoResize: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  let maps: FakeMapInstance[];
  let mapOptions: unknown[];

  beforeEach(() => {
    maps = [];
    mapOptions = [];
    overlayInstances.length = 0;
    class FakeMap {
      center: FakeLatLng;
      zoom: number;
      getCenter = () => this.center;
      getBounds = () => new FakeLatLngBounds(new FakeLatLng(37, 126), new FakeLatLng(38, 128));
      getZoom = () => this.zoom;
      setCenter = vi.fn((center: FakeLatLng) => {
        this.center = center;
      });
      setZoom = vi.fn((zoom: number) => {
        this.zoom = zoom;
      });
      refresh = vi.fn();
      autoResize = vi.fn();
      destroy = vi.fn();

      constructor(_: HTMLElement, options: { center: FakeLatLng; zoom: number }) {
        mapOptions.push(options);
        this.center = options.center;
        this.zoom = options.zoom;
        maps.push(this);
      }
    }

    Object.defineProperty(window, 'naver', {
      configurable: true,
      value: {
        maps: {
          LatLng: FakeLatLng,
          LatLngBounds: FakeLatLngBounds,
          Map: FakeMap,
          OverlayView: FakeOverlay,
          Circle: FakeOverlay,
          Polygon: FakeOverlay,
          Event: { addListener: vi.fn(() => ({})), removeListener: vi.fn() },
        },
      },
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  });

  afterEach(() => {
    Object.defineProperty(window, 'naver', { configurable: true, value: undefined });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('동네에 마우스를 올리면 채움이 진해지고 벗어나면 복원한다', async () => {
    const { unmount } = renderWithConfig(
      <MapCanvas
        center={{ latitude: 37.5, longitude: 127 }}
        interactive
        regions={[
          {
            id: '11230640',
            name: '역삼1동',
            isRecommended: true,
            paths: [
              [
                { latitude: 37.5, longitude: 127 },
                { latitude: 37.6, longitude: 127 },
                { latitude: 37.5, longitude: 127.1 },
                { latitude: 37.5, longitude: 127 },
              ],
            ],
          },
        ]}
      />,
    );
    await waitFor(() =>
      expect(window.naver!.maps.Event.addListener).toHaveBeenCalledWith(
        expect.anything(),
        'mouseover',
        expect.any(Function),
      ),
    );
    const calls = vi.mocked(window.naver!.maps.Event.addListener).mock.calls;
    const enter = calls.find((call) => call[1] === 'mouseover')!;
    const leave = calls.find((call) => call[1] === 'mouseout')!;
    act(() => enter[2]());
    expect((enter[0] as FakeOverlay).setOptions.mock.lastCall?.[0].fillOpacity).toBeCloseTo(0.34);
    act(() => leave[2]());
    expect((leave[0] as FakeOverlay).setOptions).toHaveBeenLastCalledWith({ fillOpacity: 0.24 });
    unmount();
    expect(window.naver!.maps.Event.removeListener).toHaveBeenCalled();
  });

  it('선택 변경에는 경계를 재사용하고 좌표가 바뀐 동만 교체하며 제거 시 정리한다', async () => {
    const region: MapRegion = {
      id: 'a',
      name: '동네',
      isRecommended: true,
      paths: [
        [
          { latitude: 37.5, longitude: 127 },
          { latitude: 37.6, longitude: 127.1 },
        ],
      ],
    };
    const onSelect = vi.fn();
    const center = { latitude: 37.5, longitude: 127 };
    const { rerender, unmount } = renderWithConfig(<MapCanvas center={center} regions={[region]} />);
    await waitFor(() => expect(overlayInstances).toHaveLength(1));
    const original = overlayInstances[0];
    rerender(<MapCanvas center={center} regions={[{ ...region }]} selectedRegionId="a" onSelectRegion={onSelect} />);
    expect(overlayInstances).toHaveLength(1);
    expect(original.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ fillOpacity: 0.5 }));
    const click = vi
      .mocked(window.naver!.maps.Event.addListener)
      .mock.calls.find((call) => call[0] === original && call[1] === 'click')!;
    act(() => click[2]());
    expect(onSelect).toHaveBeenCalledWith('a');
    rerender(<MapCanvas center={center} regions={[{ ...region, paths: [...region.paths] }]} />);
    expect(overlayInstances).toHaveLength(1);
    expect(original.setPaths).toHaveBeenCalledOnce();
    rerender(<MapCanvas center={center} regions={[]} />);
    expect(original.setMap).toHaveBeenCalledWith(null);
    expect(window.naver!.maps.Event.removeListener).toHaveBeenCalledTimes(3);
    unmount();
    expect(window.naver!.maps.Event.removeListener).toHaveBeenCalledTimes(
      vi.mocked(window.naver!.maps.Event.addListener).mock.calls.length,
    );
  });

  it('idle 시 실제 줌 등급에 맞춰 좌표만 교체하고 같은 등급의 이동에는 갱신하지 않는다', async () => {
    const original = [
      [
        [
          { latitude: 37, longitude: 127 },
          { latitude: 37.1, longitude: 127 },
          { latitude: 37, longitude: 127.1 },
          { latitude: 37, longitude: 127 },
        ],
      ],
    ];
    const overview = [[original[0][0].slice()]];
    const medium = [[original[0][0].slice()]];
    renderWithConfig(
      <MapCanvas
        center={original[0][0][0]}
        level={10}
        regions={[{ id: 'a', name: '동', paths: [], polygons: original, simplifiedPolygons: { overview, medium } }]}
      />,
    );
    await waitFor(() => expect(overlayInstances).toHaveLength(1));
    const polygon = overlayInstances[0];
    const idle = vi
      .mocked(window.naver!.maps.Event.addListener)
      .mock.calls.find((call) => call[0] === maps[0] && call[1] === 'idle')!;
    maps[0].zoom = 14;
    act(() => idle[2]());
    expect(polygon.setPaths).toHaveBeenCalledTimes(1);
    maps[0].zoom = 16;
    act(() => idle[2]());
    expect(polygon.setPaths).toHaveBeenCalledTimes(2);
    maps[0].zoom = 17;
    act(() => idle[2]());
    expect(polygon.setPaths).toHaveBeenCalledTimes(2);
    maps[0].zoom = 10;
    act(() => idle[2]());
    expect(polygon.setPaths).toHaveBeenCalledTimes(3);
    expect(overlayInstances).toHaveLength(1);
  });

  it('새 결과는 drawStage 순서로 나눠 등록하고 이후 선택 변경은 바로 반영한다', async () => {
    const ring = [
      { latitude: 37.5, longitude: 127 },
      { latitude: 37.6, longitude: 127.1 },
    ];
    const region = (id: string, drawStage: number): MapRegion => ({ id, name: id, paths: [ring], drawStage });
    const regions = [region('slow', 2), region('fast', 0), region('medium', 1)];
    const queued: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => queued.push(callback));
    const frames = () =>
      act(() => {
        for (let i = 0; i < 2; i++) queued.splice(0).forEach((callback) => callback(performance.now()));
      });
    const { rerender } = renderWithConfig(<MapCanvas center={ring[0]} regions={regions} />);
    await waitFor(() => expect(overlayInstances).toHaveLength(1));
    frames();
    expect(overlayInstances).toHaveLength(2);
    frames();
    expect(overlayInstances).toHaveLength(3);
    frames();
    expect(overlayInstances).toHaveLength(3);
    rerender(<MapCanvas center={ring[0]} regions={regions} selectedRegionId="slow" />);
    expect(overlayInstances).toHaveLength(3);
    expect(overlayInstances[2].setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ strokeWeight: 2 }));
  });

  it('같은 단계에서는 지도 중심에 가까운 동부터 한 묶음씩 등록한다', async () => {
    const center = { latitude: 37.5, longitude: 127 };
    const ring = (latitude: number) => [
      { latitude, longitude: 127 },
      { latitude: latitude + 0.001, longitude: 127.001 },
    ];
    // 먼 동을 배열 맨 앞에 두어 입력 순서가 아니라 거리로 고르는지 확인한다.
    const far: MapRegion = { id: 'far', name: 'far', paths: [ring(38.5)], center: { latitude: 38.5, longitude: 127 } };
    const near = Array.from({ length: 40 }, (_, index): MapRegion => ({
      id: `near-${index}`,
      name: `near-${index}`,
      paths: [ring(37.5 + index * 0.001)],
      center: { latitude: 37.5 + index * 0.001, longitude: 127 },
    }));
    const queued: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => queued.push(callback));
    renderWithConfig(<MapCanvas center={center} regions={[far, ...near]} />);
    await waitFor(() => expect(overlayInstances).toHaveLength(40));
    expect(overlayInstances.some((polygon) => polygon.options?.paths?.[0][0].lat() === 38.5)).toBe(false);
    act(() => {
      for (let i = 0; i < 2; i++) queued.splice(0).forEach((callback) => callback(performance.now()));
    });
    expect(overlayInstances).toHaveLength(41);
    expect(overlayInstances[40].options?.paths?.[0][0].lat()).toBe(38.5);
  });

  it('분리된 면과 내부 링을 그대로 전달하고 중복 광택 경계를 만들지 않는다', async () => {
    const ring = [
      { latitude: 37.5, longitude: 127 },
      { latitude: 37.6, longitude: 127.1 },
    ];
    const { unmount } = renderWithConfig(
      <MapCanvas
        center={ring[0]}
        regions={[
          {
            id: 'multi',
            name: '분리된 동',
            paths: [ring],
            polygons: [[ring, ring], [ring]],
            appearance: { fillColor: '#ff0000', strokeColor: '#000000' },
          },
        ]}
      />,
    );
    await waitFor(() => expect(overlayInstances).toHaveLength(2));
    expect(overlayInstances[0].options?.paths).toHaveLength(2);
    expect(overlayInstances[1].options?.paths).toHaveLength(1);
    expect(overlayInstances[0].options?.paths?.[0][0].lat()).toBe(37.5);
    unmount();
    overlayInstances.forEach((overlay) => expect(overlay.setMap).toHaveBeenCalledWith(null));
  });

  it('크기가 달라질 때만 autoResize를 호출하고 타일 새로고침은 하지 않는다', async () => {
    const resizeCallbacks: (() => void)[] = [];
    class FakeResizeObserver {
      constructor(private readonly callback: () => void) {}
      observe = () => {
        resizeCallbacks.push(this.callback);
      };
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    renderWithConfig(<MapCanvas center={{ latitude: 37.5665, longitude: 126.978 }} level={5} />);
    await waitFor(() => expect(resizeCallbacks).toHaveLength(1));

    expect(() => resizeCallbacks[0]()).not.toThrow();
    await waitFor(() => expect(maps[0].autoResize).toHaveBeenCalledOnce());
    resizeCallbacks[0]();
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(maps[0].autoResize).toHaveBeenCalledOnce();
    expect(maps[0].refresh).not.toHaveBeenCalled();
  });

  it('앱 확대 단계를 반대 방향인 Naver zoom으로 바꿔 전달한다', async () => {
    renderWithConfig(<MapCanvas center={{ latitude: 37.5665, longitude: 126.978 }} level={5} />);

    await waitFor(() => expect(maps).toHaveLength(1));
    expect(maps[0].zoom).toBe(15);
    expect(mapOptions[0]).not.toHaveProperty('customStyleId');
    expect(mapOptions[0]).not.toHaveProperty('gl');
  });

  it('SDK 로딩 중 좌표가 바뀌면 최신 좌표와 확대 수준으로 생성한다', async () => {
    const sdk = window.naver;
    Object.defineProperty(window, 'naver', { configurable: true, value: undefined });
    const { rerender } = renderWithConfig(<MapCanvas center={{ latitude: 37.5, longitude: 127 }} level={5} />);
    const script = document.querySelector('script[data-jachwi-naver-map]')!;
    expect(script).not.toBeNull();
    rerender(<MapCanvas center={{ latitude: 37.6, longitude: 127.1 }} level={7} />);
    Object.defineProperty(window, 'naver', { configurable: true, value: sdk });
    await act(async () => {
      script.dispatchEvent(new Event('load'));
      window.jachwiNaverSdkReady?.();
    });
    expect(maps).toHaveLength(1);
    expect(maps[0].center.lat()).toBe(37.6);
    expect(maps[0].center.lng()).toBe(127.1);
    expect(maps[0].zoom).toBe(13);
    script.remove();
  });

  it('지도 생성 및 이동 완료 때 SDK의 실제 표시 경계를 전달한다', async () => {
    const onBoundsChange = vi.fn();
    renderWithConfig(<MapCanvas center={{ latitude: 37.5, longitude: 127 }} onBoundsChange={onBoundsChange} />);
    await waitFor(() => expect(onBoundsChange).toHaveBeenCalledWith({ south: 37, west: 126, north: 38, east: 128 }));
    const listener = vi.mocked(window.naver!.maps.Event.addListener).mock.calls.find((call) => call[1] === 'idle');
    expect(listener).toBeDefined();
    onBoundsChange.mockClear();
    listener![2]();
    expect(onBoundsChange).toHaveBeenCalledWith({ south: 37, west: 126, north: 38, east: 128 });
  });

  it('중심 좌표만 갱신될 때 사용자가 바꾼 확대 단계를 되돌리지 않는다', async () => {
    const disconnect = vi.fn();
    let resizeObserverCount = 0;
    class FakeResizeObserver {
      constructor(_: () => void) {
        resizeObserverCount += 1;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { rerender } = renderWithConfig(<MapCanvas center={{ latitude: 37.5665, longitude: 126.978 }} level={5} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;

    rerender(<MapCanvas center={{ latitude: 37.567, longitude: 126.979 }} level={5} />);

    await waitFor(() => expect(map.setCenter).toHaveBeenCalledOnce());
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.zoom).toBe(15);
    expect(resizeObserverCount).toBe(1);
    expect(disconnect).not.toHaveBeenCalled();
    expect(map.refresh).not.toHaveBeenCalled();
  });

  it('사용자가 지도에서 확대 단계를 바꾸면 같은 단계를 다시 지정하지 않는다', async () => {
    const { rerender } = renderWithConfig(<MapCanvas center={{ latitude: 37.5665, longitude: 126.978 }} level={5} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    map.zoom = 17;

    rerender(<MapCanvas center={{ latitude: 37.5665, longitude: 126.978 }} level={3} />);

    await waitFor(() => expect(map.zoom).toBe(17));
    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it('라이브 마커는 확대 중 레이아웃 대신 transform으로 위치를 갱신한다', async () => {
    const { rerender } = renderWithConfig(
      <MapCanvas
        center={{ latitude: 37.5665, longitude: 126.978 }}
        level={5}
        markers={[
          {
            id: 'property-10',
            latitude: 37.5665,
            longitude: 126.978,
            label: '테스트 매물',
            tone: 'property',
          },
        ]}
      />,
    );

    await waitFor(() => expect(overlayInstances).toHaveLength(1));
    const marker = overlayInstances[0].pane.firstElementChild;
    expect(marker).toBeInstanceOf(HTMLElement);
    expect(marker).toHaveStyle({
      left: '0px',
      top: '0px',
      transform: 'translate3d(120px, 80px, 0)',
      willChange: 'transform',
    });
    expect(marker?.firstElementChild).toHaveStyle({ transform: 'translate(-50%, -120.710678%)' });
    const content = marker?.firstElementChild as HTMLElement;
    expect(content.style.getPropertyValue('--map-marker-scale')).toBe('0.88');
    rerender(
      <MapCanvas
        center={{ latitude: 37.5665, longitude: 126.978 }}
        level={1}
        markers={[
          {
            id: 'property-10',
            latitude: 37.5665,
            longitude: 126.978,
            label: '테스트 매물',
            tone: 'property',
          },
        ]}
      />,
    );
    await waitFor(() => expect(content.style.getPropertyValue('--map-marker-scale')).toBe('1.36'));
    expect(overlayInstances).toHaveLength(1);
    expect(marker?.firstElementChild).toBe(content);
  });

  it('마커가 없어도 화면을 나가면 SDK 인스턴스와 이벤트를 정리한다', async () => {
    const { unmount } = renderWithConfig(<MapCanvas center={{ latitude: 37.5, longitude: 127 }} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const listenerCount = vi.mocked(window.naver!.maps.Event.addListener).mock.calls.length;
    unmount();
    expect(maps[0].destroy).toHaveBeenCalledOnce();
    expect(window.naver!.maps.Event.removeListener).toHaveBeenCalledTimes(listenerCount);
  });

  it('같은 반경 배열을 새로 받아도 원을 다시 만들지 않는다', async () => {
    const center = { latitude: 37.5, longitude: 127 };
    const { rerender } = renderWithConfig(
      <MapCanvas center={center} circles={[{ radiusMeters: 500, label: '500m' }]} />,
    );
    await waitFor(() => expect(overlayInstances).toHaveLength(1));
    rerender(<MapCanvas center={center} circles={[{ radiusMeters: 500, label: '500m' }]} />);
    expect(overlayInstances).toHaveLength(1);
    expect(overlayInstances[0].setMap).not.toHaveBeenCalledWith(null);
    rerender(<MapCanvas center={center} circles={[{ radiusMeters: 1000, label: '1km' }]} />);
    await waitFor(() => expect(overlayInstances).toHaveLength(2));
    expect(overlayInstances[0].setMap).toHaveBeenCalledWith(null);
  });

  it('드래그 중 새 마커 처리를 미루고 멈추면 최신 마커와 콜백을 적용한다', async () => {
    const center = { latitude: 37.5, longitude: 127 };
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderWithConfig(<MapCanvas center={center} onCenterChange={first} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const calls = vi.mocked(window.naver!.maps.Event.addListener).mock.calls;
    const drag = calls.find((call) => call[1] === 'dragstart')![2];
    const idle = calls.find((call) => call[1] === 'idle')![2];
    act(() => drag());
    rerender(
      <MapCanvas
        center={center}
        onCenterChange={latest}
        markers={[{ id: 'new', ...center, label: '새 매물', tone: 'property' }]}
      />,
    );
    expect(overlayInstances).toHaveLength(0);
    act(() => idle());
    await waitFor(() => expect(overlayInstances).toHaveLength(1));
    expect(latest).toHaveBeenCalledWith(37.5, 127);
    expect(first).not.toHaveBeenCalled();
    expect(maps).toHaveLength(1);
  });
});
