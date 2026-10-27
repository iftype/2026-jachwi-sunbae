import { describe, expect, it, vi } from 'vitest';

import type { MapMarker } from '@/features/map/model/Map';
import { createMapMarkerElement } from '@/features/map/ui/map-marker/MapMarkerView';
import logoImage from '@/shared/assets/jachwi-sunbae-goose.webp';

describe('매물 마커의 지도 SDK 요소 변환', () => {
  it.each(['property', 'propertyCluster'] as const)('%s 마커는 자취선배 로고를 넣은 마커 버튼을 반환한다', (tone) => {
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
    expect(element.querySelector('img')?.getAttribute('src')).toBe(logoImage);
    expect(element.textContent).not.toContain('신림역 원룸');
    element.click();
    expect(onSelect).toHaveBeenCalledWith(marker);
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
