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

const pin = (propertyId: number, latitude: number, longitude: number, photoUrl?: string) => ({
  propertyId,
  name: `매물 ${propertyId}`,
  latitude,
  longitude,
  caption: '보증금 1,000 / 월세 55',
  photoUrl,
});

describe('지도 매물 군집', () => {
  it('매물 하나는 대표 사진을 넣은 핀으로 보여 준다', () => {
    const markers = clusterProperties([pin(1, 37.5665, 126.978, 'blob:photo-1')], 6);

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      id: 'property-1',
      tone: 'property',
      photoUrl: 'blob:photo-1',
      label: '매물 1',
      actionable: true,
    });
    expect(markers[0].count).toBeUndefined();
  });

  it('겹치는 매물은 좌표 중심으로 묶고 묶음 숫자를 보여 준다', () => {
    const markers = clusterProperties(
      [pin(1, 37.5665, 126.978), pin(2, 37.5666, 126.9781, 'blob:photo-2'), pin(3, 37.58, 126.99)],
      6,
    );

    expect(markers).toHaveLength(2);
    const cluster = markers.find((marker) => marker.tone === 'propertyCluster');
    expect(cluster).toMatchObject({ id: 'property-cluster-1-2', count: 2, label: '매물 2개', actionable: true });
    expect(cluster?.latitude).toBeCloseTo((37.5665 + 37.5666) / 2, 6);
    // 묶음 안에 사진이 있는 매물이 있으면 그 사진을 대표로 쓴다.
    expect(cluster?.photoUrl).toBe('blob:photo-2');
    expect(markers.find((marker) => marker.id === 'property-3')).toBeDefined();
  });

  it('충분히 확대하면 겹쳐 있던 매물도 각각 보여 준다', () => {
    const markers = clusterProperties([pin(1, 37.5665, 126.978), pin(2, 37.5666, 126.9781)], 3);

    expect(markers).toHaveLength(2);
    expect(markers.every((marker) => marker.tone === 'property')).toBe(true);
  });
});
