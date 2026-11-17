// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  AREA_FOCUS_FALLBACK_LEVEL,
  AREA_FOCUS_MAX_LEVEL,
  AREA_FOCUS_MIN_LEVEL,
  areaFocusLevel,
  desktopMapViewport,
  mobileMapViewport,
  nextPlacesVisible,
  PLACES_HIDE_LEVEL,
  PLACES_SHOW_LEVEL,
  RESULT_OVERVIEW_LEVEL,
  resultMapCenter,
  routeFocusView,
} from '@/pages/neighborhood-preview/model/resultMapView';

it('지도 중심은 남쪽으로 옮겨 결과 위치가 중앙보다 위에 표시된다', () => {
  const point = { latitude: 37.5, longitude: 127 };
  expect(resultMapCenter(point, 7).latitude).toBeLessThan(point.latitude);
  expect(resultMapCenter(point, 7).longitude).toBe(point.longitude);
});
it('확대율이 달라도 동일한 픽셀 간격만큼 조정한다', () => {
  const point = { latitude: 37.5, longitude: 127 };
  const delta = (level: number) => {
    const y = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
    return (y(resultMapCenter(point, level).latitude) - y(point.latitude)) * 256 * 2 ** (20 - level);
  };
  expect(delta(7)).toBeCloseTo(48);
  expect(delta(10)).toBeCloseTo(48);
});

/** 위도 37.5, 경도 127을 가운데로 가로세로 `meters`m인 네모 동네 경계. */
const squareArea = (meters: number) => {
  const latitudeSpan = meters / 111_320;
  const longitudeSpan = meters / (111_320 * Math.cos((37.5 * Math.PI) / 180));
  const [south, north] = [37.5 - latitudeSpan / 2, 37.5 + latitudeSpan / 2];
  const [west, east] = [127 - longitudeSpan / 2, 127 + longitudeSpan / 2];
  return [
    [
      [
        { latitude: south, longitude: west },
        { latitude: north, longitude: west },
        { latitude: north, longitude: east },
        { latitude: south, longitude: east },
      ],
    ],
  ];
};
/** Naver 지도에서 확대 단계 `level`일 때 위도 37.5의 1px이 덮는 거리(m). 실제 지도에서 단계 5가 약 1.9m였다. */
const metersPerPixel = (level: number) => ((156_543.03 * Math.cos((37.5 * Math.PI) / 180)) / 2 ** 21) * 2 ** level;

it('동네를 고르면 동네 크기에 맞춰 경계 전체가 340x300px 안에 들어가는 단계로 다가간다', () => {
  const level = areaFocusLevel(squareArea(1000));
  expect(level).toBeGreaterThan(AREA_FOCUS_MIN_LEVEL);
  expect(level).toBeLessThan(AREA_FOCUS_MAX_LEVEL);
  // 1km 동네는 세로 300px에 꼭 맞는다.
  expect(1000 / metersPerPixel(level)).toBeCloseTo(300, 0);
  expect(areaFocusLevel(squareArea(800))).toBeLessThan(level);
});
it('작은 동네도 예전 단계(5)보다 가까이 가지 않고, 큰 동네도 마커가 보이는 단계보다 멀리 가지 않는다', () => {
  expect(areaFocusLevel(squareArea(200))).toBe(AREA_FOCUS_MIN_LEVEL);
  expect(areaFocusLevel(squareArea(5000))).toBe(AREA_FOCUS_MAX_LEVEL);
  // 동네를 고르자마자 정류장과 부동산 마커가 올라와야 한다.
  expect(nextPlacesVisible(false, areaFocusLevel(squareArea(5000)))).toBe(true);
});
it('경계를 아직 받지 못한 동네는 정해 둔 단계로 다가간다', () => {
  expect(areaFocusLevel([])).toBe(AREA_FOCUS_FALLBACK_LEVEL);
  expect(nextPlacesVisible(false, AREA_FOCUS_FALLBACK_LEVEL)).toBe(true);
});
it('마커는 7.5 이하에서 올리고, 올린 뒤에는 8을 넘어야 거둔다', () => {
  expect(nextPlacesVisible(false, 7.51)).toBe(false);
  expect(nextPlacesVisible(false, PLACES_SHOW_LEVEL)).toBe(true);
  // 지도가 7.5로 옮겨 7.5000001에 멈춰도 올린다.
  expect(nextPlacesVisible(false, PLACES_SHOW_LEVEL + 1e-7)).toBe(true);
  expect(nextPlacesVisible(true, PLACES_HIDE_LEVEL)).toBe(true);
  expect(nextPlacesVisible(true, 8.11)).toBe(false);
});

describe('routeFocusView', () => {
  const destination = { latitude: 37.3958, longitude: 127.111 };
  // 위도 0.01도는 약 1.1km다.
  const northOf = (km: number) => ({ latitude: destination.latitude + km / 111.32, longitude: destination.longitude });

  it('출발 정류장에서 출퇴근 장소까지 경로가 길면 동네만 볼 때(6.5)보다 멀리 본다', () => {
    const view = routeFocusView([northOf(8), destination]);
    expect(view.level).toBeGreaterThan(AREA_FOCUS_MAX_LEVEL);
    expect(view.level).toBeLessThanOrEqual(RESULT_OVERVIEW_LEVEL);
  });

  it('경로가 길수록 더 멀리 보고, 너무 가깝거나 멀지 않게 5~10단계 안으로 자른다', () => {
    expect(routeFocusView([northOf(4), destination]).level).toBeLessThan(
      routeFocusView([northOf(8), destination]).level,
    );
    expect(routeFocusView([northOf(0.05), destination]).level).toBe(AREA_FOCUS_MIN_LEVEL);
    expect(routeFocusView([northOf(300), destination]).level).toBe(RESULT_OVERVIEW_LEVEL);
  });

  it('범위 가운데를 아래 시트만큼 위로 올려 둔다', () => {
    const start = northOf(8);
    const view = routeFocusView([start, destination]);
    const middle = { latitude: (start.latitude + destination.latitude) / 2, longitude: destination.longitude };
    expect(view).toEqual({ ...resultMapCenter(middle, view.level), level: view.level });
  });

  it('지도 칸을 주면 시트와 상세 칸이 가리는 여백을 빼고 남은 칸에 맞춘다', () => {
    const route = [northOf(1.5), destination];
    const phone = mobileMapViewport({ width: 390, height: 844 }, 110)!;
    // 여백을 크게 주면 남은 칸이 좁아져 더 멀리 본다.
    const covered = { ...phone, padding: { ...phone.padding, bottom: 600 } };
    expect(routeFocusView(route, [], covered).level).toBeGreaterThan(routeFocusView(route, [], phone).level);
  });

  it('아래 시트가 가리면 경로 가운데가 남은 칸 가운데에 오게 지도 중심을 남쪽으로 둔다', () => {
    const route = [northOf(1.5), destination];
    const middleLatitude = (route[0].latitude + destination.latitude) / 2;
    const view = routeFocusView(route, [], mobileMapViewport({ width: 390, height: 844 }, 110)!);
    expect(view.latitude).toBeLessThan(middleLatitude);
    // 오른쪽 레일 줄 여백이 더 커서 가운데를 그만큼 동쪽으로 둔다.
    expect(view.longitude).toBeGreaterThan(destination.longitude);
  });

  it('데스크탑은 지도 칸 폭을 그대로 쓰고, 왼쪽 필터와 정보 카드, 오른쪽 레일 줄 자리를 여백으로 비운다', () => {
    const view = desktopMapViewport({ width: 922, height: 736 });
    expect(view?.width).toBe(922);
    expect(view?.padding).toEqual({ top: 24, right: 80, bottom: 40, left: 384 });
    expect(desktopMapViewport({ width: 0, height: 0 }, { width: 1280, isDetailOpen: false })).toBeNull();
    expect(mobileMapViewport({ width: 0, height: 0 }, 0)).toBeNull();
  });

  it('동네 경계를 함께 주면 경계 바깥 끝까지 화면에 담는다', () => {
    const narrow = routeFocusView([northOf(1), destination]);
    const withArea = routeFocusView([northOf(1), destination], squareArea(6000));
    expect(withArea.level).toBeGreaterThan(narrow.level);
  });
});
