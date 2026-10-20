// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { clusterNearbyPlaces, clusterProperties } from '@/features/map/lib/mapClustering';
import type { NearbyPlace } from '@/features/map/model/Map';

const place = (id: string, latitude: number, longitude: number, category: NearbyPlace['category'] = 'TRANSPORT') => ({
  providerPlaceId: id,
  name: `장소 ${id}`,
  category,
  address: '서울 중구 세종대로',
  latitude,
  longitude,
  distanceMeters: Number(id.replace(/\D/g, '')) || 0,
});

describe('지도 장소 군집', () => {
  it('확대한 지도에서는 실제 장소를 각각 표시한다', () => {
    const markers = clusterNearbyPlaces([place('bus-1', 37.5665, 126.978), place('bus-2', 37.5665, 126.978)], 3);

    expect(markers).toHaveLength(2);
    expect(markers.map((marker) => marker.label)).toEqual(['장소 bus-1', '장소 bus-2']);
    expect(markers.every((marker) => marker.tone === 'place')).toBe(true);
    expect(markers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ placeId: 'bus-1', actionable: true }),
        expect.objectContaining({ placeId: 'bus-2', actionable: true }),
      ]),
    );
  });

  it('축소한 지도에서는 가까운 장소만 실제 좌표의 중심으로 묶는다', () => {
    const markers = clusterNearbyPlaces(
      [
        place('bus-1', 37.5665, 126.978),
        place('bus-2', 37.56655, 126.978),
        place('hospital-3', 37.57, 126.982, 'HOSPITAL'),
      ],
      5,
    );

    expect(markers).toHaveLength(2);
    expect(markers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tone: 'cluster', category: 'TRANSPORT', count: 2, label: '교통 2개' }),
        expect.objectContaining({ tone: 'place', category: 'HOSPITAL', label: '장소 hospital-3' }),
      ]),
    );
    expect(markers.find((marker) => marker.tone === 'cluster')).toEqual(expect.objectContaining({ actionable: true }));
  });

  it('서로 다른 카테고리는 좌표가 가까워도 색과 아이콘을 유지하도록 따로 표시한다', () => {
    const markers = clusterNearbyPlaces(
      [place('hospital-1', 37.5665, 126.978, 'HOSPITAL'), place('store-2', 37.5665, 126.978, 'CONVENIENCE')],
      6,
    );

    expect(markers).toHaveLength(2);
    expect(markers.map((marker) => marker.category)).toEqual(['HOSPITAL', 'CONVENIENCE']);
  });
});

const pin = (propertyId: number, latitude: number, longitude: number) => ({
  propertyId,
  name: `매물 ${propertyId}`,
  latitude,
  longitude,
  caption: '보증금 1,000 / 월세 55',
});

describe('지도 매물 군집', () => {
  it('매물 하나는 개별 핀으로 보여 준다', () => {
    const markers = clusterProperties([pin(1, 37.5665, 126.978)], 6);

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      id: 'property-1',
      tone: 'property',
      label: '매물 1',
      actionable: true,
    });
    expect(markers[0].count).toBeUndefined();
  });

  it('겹치는 매물은 좌표 중심으로 묶고 묶음 숫자를 보여 준다', () => {
    const markers = clusterProperties([pin(1, 37.5665, 126.978), pin(2, 37.5666, 126.9781), pin(3, 37.58, 126.99)], 6);

    expect(markers).toHaveLength(2);
    const cluster = markers.find((marker) => marker.tone === 'propertyCluster');
    expect(cluster).toMatchObject({ id: 'property-cluster-1-2', count: 2, label: '매물 2개', actionable: true });
    expect(cluster?.latitude).toBeCloseTo((37.5665 + 37.5666) / 2, 6);
    expect(markers.find((marker) => marker.id === 'property-3')).toBeDefined();
  });

  it('충분히 확대하면 겹쳐 있던 매물도 각각 보여 준다', () => {
    const markers = clusterProperties([pin(1, 37.5665, 126.978), pin(2, 37.5666, 126.9781)], 3);

    expect(markers).toHaveLength(2);
    expect(markers.every((marker) => marker.tone === 'property')).toBe(true);
  });
});

// 위도 1도는 약 111,320m다. 경도는 위도 37.57도 기준 cos 값(약 0.793)만큼 짧아진다.
const metersToLatitude = (meters: number) => meters / 111_320;

describe('지도 군집 반경', () => {
  const base = { latitude: 37.5665, longitude: 126.978 };
  const pairAt = (meters: number) => [
    place('a-1', base.latitude, base.longitude),
    place('a-2', base.latitude + metersToLatitude(meters), base.longitude),
  ];

  it.each([
    [4, 80, 2],
    [5, 80, 1],
    [5, 150, 2],
    [6, 150, 1],
    [6, 300, 2],
    [7, 300, 1],
    [7, 600, 2],
    [8, 600, 1],
    [8, 1_200, 2],
    [9, 1_200, 1],
  ])('레벨 %i에서 %im 떨어진 두 장소는 마커 %i개가 된다', (level, meters, expected) => {
    expect(clusterNearbyPlaces(pairAt(meters), level)).toHaveLength(expected);
  });

  it('경도 거리는 위도에 따라 줄어든 실제 거리로 계산한다', () => {
    // 경도 0.0011도는 적도에서 약 122m지만 위도 37.57도에서는 약 97m다.
    const pair = [place('a-1', base.latitude, base.longitude), place('a-2', base.latitude, base.longitude + 0.0011)];

    expect(clusterNearbyPlaces(pair, 4)).toHaveLength(2);
    expect(clusterNearbyPlaces(pair, 5)).toHaveLength(1);
  });

  it('레벨 3 이하에서는 좌표가 같아도 묶지 않는다', () => {
    expect(clusterNearbyPlaces([place('a-1', 37.5665, 126.978), place('a-2', 37.5665, 126.978)], 3)).toHaveLength(2);
    expect(clusterProperties([pin(1, 37.5665, 126.978), pin(2, 37.5665, 126.978)], 3)).toHaveLength(2);
  });
});

describe('지도 군집 마커 식별자와 중심', () => {
  it('장소 하나는 provider id로 마커 id를 만든다', () => {
    expect(clusterNearbyPlaces([place('bus-7', 37.5665, 126.978)], 6)[0].id).toBe('place-bus-7');
  });

  it('장소 묶음은 정렬한 provider id를 이어 붙인 id와 좌표 평균 중심을 가진다', () => {
    const markers = clusterNearbyPlaces(
      [place('bus-3', 37.5667, 126.9783), place('bus-1', 37.5665, 126.978), place('bus-2', 37.5666, 126.9781)],
      6,
    );

    expect(markers).toHaveLength(1);
    expect(markers[0].id).toBe('cluster-bus-1-bus-2-bus-3');
    expect(markers[0].latitude).toBeCloseTo((37.5665 + 37.5666 + 37.5667) / 3, 8);
    expect(markers[0].longitude).toBeCloseTo((126.978 + 126.9781 + 126.9783) / 3, 8);
  });

  it('장소는 가까운 순서로 군집의 씨앗이 되고, 거리가 같으면 provider id 순서를 따른다', () => {
    const origin = 37.5665;
    const places = [
      place('far-30', origin + metersToLatitude(160), 126.978),
      place('near-10', origin, 126.978),
      place('mid-20', origin + metersToLatitude(80), 126.978),
    ];

    const markers = clusterNearbyPlaces(places, 5);

    expect(markers.map((marker) => marker.id).sort()).toEqual(['cluster-mid-20-near-10', 'place-far-30']);

    const tie = [
      place('b-5', origin + metersToLatitude(160), 126.978),
      place('c-5', origin + metersToLatitude(80), 126.978),
      place('a-5', origin, 126.978),
    ];
    expect(
      clusterNearbyPlaces(tie, 5)
        .map((marker) => marker.id)
        .sort(),
    ).toEqual(['cluster-a-5-c-5', 'place-b-5']);
  });

  it('매물 묶음은 번호가 낮은 매물 순서로 묶는다', () => {
    const markers = clusterProperties(
      [pin(3, 37.5667, 126.9783), pin(1, 37.5665, 126.978), pin(2, 37.5666, 126.9781)],
      6,
    );

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 'property-cluster-1-2-3', count: 3 });
    expect(markers[0].latitude).toBeCloseTo((37.5665 + 37.5666 + 37.5667) / 3, 8);
    expect(markers[0].longitude).toBeCloseTo((126.978 + 126.9781 + 126.9783) / 3, 8);
  });
});
