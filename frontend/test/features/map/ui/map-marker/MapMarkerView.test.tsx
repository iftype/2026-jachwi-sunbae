import { describe, expect, it, vi } from 'vitest';

import { mapCategoryMarkerSrc, propertyMarkerSrc, stationVariant } from '@/features/map/lib/mapIconAssets';
import type { MapMarker } from '@/features/map/model/Map';
import { createMapMarkerElement } from '@/features/map/ui/map-marker/MapMarkerView';

describe('매물 마커의 지도 SDK 요소 변환', () => {
  it.each(['property', 'propertyCluster'] as const)('%s 마커는 집 핀 이미지를 넣은 마커 버튼을 반환한다', (tone) => {
    const marker: MapMarker = {
      id: 'property-10',
      latitude: 37.48,
      longitude: 126.93,
      label: '신림역 원룸',
      tone,
      count: tone === 'propertyCluster' ? 2 : undefined,
      actionable: true,
    };
    const onSelect = vi.fn();
    const element = createMapMarkerElement(marker, marker.id, onSelect);
    expect(element.tagName).toBe('BUTTON');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(propertyMarkerSrc);
    expect(element.textContent).not.toContain('신림역 원룸');
    element.click();
    expect(onSelect).toHaveBeenCalledWith(marker);
  });
});

describe('시설 마커', () => {
  it('카테고리 핀 이미지를 넣고 군집이면 숫자 배지를 붙인다', () => {
    const element = createMapMarkerElement(
      {
        id: 'stop-1',
        latitude: 37.48,
        longitude: 126.93,
        label: '신림역 정류장',
        tone: 'cluster',
        category: 'TRANSPORT',
        count: 3,
      },
      null,
    );
    expect(element.querySelector('img')?.getAttribute('src')).toBe(mapCategoryMarkerSrc('TRANSPORT'));
    expect(element.textContent).toBe('3');
  });

  it('거리 메모는 싫어요를 다른 핀으로 그린다', () => {
    const element = createMapMarkerElement(
      {
        id: 'memo-1',
        latitude: 37.48,
        longitude: 126.93,
        label: '어두운 골목',
        tone: 'place',
        category: 'MEMO',
        variant: 'negative',
      },
      null,
    );
    expect(element.querySelector('img')?.getAttribute('src')).toBe(mapCategoryMarkerSrc('MEMO', 'negative'));
    expect(mapCategoryMarkerSrc('MEMO', 'negative')).not.toBe(mapCategoryMarkerSrc('MEMO', 'positive'));
  });
});

describe('통근 정류장 마커', () => {
  it('철도역(RS_) 정류장은 지하철역 핀으로, 나머지는 버스 정류장 핀으로 그린다', () => {
    const pinOf = (stopId: string) =>
      createMapMarkerElement(
        {
          id: stopId,
          latitude: 37.48,
          longitude: 126.93,
          label: '정류장',
          tone: 'place',
          category: 'TRANSPORT',
          variant: stationVariant(stopId),
        },
        null,
      )
        .querySelector('img')
        ?.getAttribute('src');
    expect(pinOf('RS_1002')).toBe(mapCategoryMarkerSrc('TRANSPORT', 'subway'));
    expect(pinOf('BS_TAGO_SEB1001')).toBe(mapCategoryMarkerSrc('TRANSPORT'));
    expect(mapCategoryMarkerSrc('TRANSPORT', 'subway')).not.toBe(mapCategoryMarkerSrc('TRANSPORT'));
  });
});

describe('고른 장소 말풍선 핀', () => {
  it('로고 대신 장소 이름을 말풍선에 담고 꼬리를 붙인다', () => {
    const element = createMapMarkerElement(
      { id: 'destination', latitude: 37.395, longitude: 127.111, label: '판교역로 166', tone: 'destination' },
      null,
    );
    expect(element.getAttribute('data-tone')).toBe('destination');
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toBe('판교역로 166');
    expect(element.children).toHaveLength(2);
  });
});

describe('겹친 거리 메모 묶음 마커', () => {
  it('좋아요와 싫어요 칸에 따봉과 개수를 함께 적고, 없는 쪽 칸은 그리지 않는다', () => {
    const marker = (positive: number, negative: number): MapMarker => ({
      id: 'street-memo:1,2,3',
      latitude: 37.48,
      longitude: 126.93,
      label: `거리 메모 ${positive + negative}개`,
      tone: 'destination',
      category: 'MEMO',
      tally: { positive, negative },
      actionable: true,
    });
    const both = createMapMarkerElement(marker(2, 1), null, vi.fn());
    expect([...both.querySelectorAll('[data-variant]')].map((cell) => cell.textContent)).toEqual(['👍 2', '👎 1']);
    const likesOnly = createMapMarkerElement(marker(3, 0), null, vi.fn());
    expect([...likesOnly.querySelectorAll('[data-variant]')].map((cell) => cell.textContent)).toEqual(['👍 3']);
  });
});

describe('주변 시설 점 마커', () => {
  it('아이콘 없이 marker.color로 칠한 작은 점으로 그린다', () => {
    const element = createMapMarkerElement(
      { id: 'dot-1', latitude: 37.48, longitude: 126.93, label: '편의점', tone: 'dot', color: '#ff8800' },
      null,
      vi.fn(),
    );
    expect(element.querySelector('img')).toBeNull();
    expect(element.style.background).toBe('rgb(255, 136, 0)');
  });
});
