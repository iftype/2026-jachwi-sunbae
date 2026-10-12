import { describe, expect, it, vi } from 'vitest';

import type { MapMarker } from '@/features/map/model/Map';
import { createMapMarkerElement } from '@/features/map/ui/map-marker/MapMarkerView';
import mascotImage from '@/shared/assets/empty-property.jpg';

describe('사진 마커의 지도 SDK 요소 변환', () => {
  it.each(['property', 'propertyCluster'] as const)(
    '사진이 있는 %s 마커도 preload 링크가 아닌 마커 버튼을 반환한다',
    (tone) => {
      const marker: MapMarker = {
        id: 'property-10',
        latitude: 37.48,
        longitude: 126.93,
        label: '신림역 원룸',
        tone,
        photoUrl: 'blob:http://localhost:3000/property-photo',
        count: tone === 'propertyCluster' ? 2 : undefined,
        actionable: true,
      };
      const onSelect = vi.fn();
      const element = createMapMarkerElement(marker, marker.id, onSelect);
      expect(element.tagName).toBe('BUTTON');
      expect(element.querySelector('img')?.getAttribute('src')).toBe(marker.photoUrl);
      expect(element.textContent).not.toContain('신림역 원룸');
      element.click();
      expect(onSelect).toHaveBeenCalledWith(marker);
    },
  );
  it('사진이 없으면 오리 로고를 표시한다', () => {
    const element = createMapMarkerElement(
      { id: 'property-1', latitude: 37, longitude: 127, label: '매물', tone: 'property' },
      null,
    );
    expect(element.querySelector('img')?.getAttribute('src')).toBe(mascotImage);
  });
});
