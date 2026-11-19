import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import type usePropertyRoute from '../../hooks/usePropertyRoute';
import type { MyPropertyRow } from '../../model/myProperty';
import FinderPropertyPanel from './FinderPropertyPanel';

const useNearbyFacilities = vi.hoisted(() => vi.fn());

vi.mock('@/features/map/api/useNearbyFacilities', () => ({ useNearbyFacilities }));
vi.mock('@/shared/config/PublicConfigContext', () => ({ usePublicConfig: () => ({ apiBaseUrl: 'http://api.test' }) }));
vi.mock('@/features/property/ui/property-card/PropertyCard', () => ({ default: () => <div>매물 카드</div> }));
vi.mock('@/pages/design-records/ui/record-list/RecordCardMenu', () => ({ default: () => null }));
vi.mock('../route-guide/RouteGuide', () => ({ default: () => <div>노선 안내</div> }));

const place = (category: string, distanceMeters: number, id: string) => ({
  providerPlaceId: id,
  name: id,
  latitude: 37.5,
  longitude: 127,
  distanceMeters,
  category,
  address: '',
});

const nearbyData = {
  center: { latitude: 37.5, longitude: 127.03 },
  radius: 500,
  counts: { HOSPITAL: 0, SCHOOL: 0, CONVENIENCE: 1, AGENCY: 0, TRANSPORT: 1 },
  places: [place('CONVENIENCE', 120, 'cu'), place('TRANSPORT', 80, 'stop')],
};

const baseProperty = {
  propertyId: 7,
  name: '내 매물',
  commute: null,
  latitude: 37.5,
  longitude: 127.03,
} as unknown as MyPropertyRow;

const destination = { name: '회사', address: '', latitude: 37.4, longitude: 127.1 };
const route = {} as ReturnType<typeof usePropertyRoute>;

const renderPanel = (property: MyPropertyRow, hasDestination = true) =>
  render(
    <FinderPropertyPanel
      property={property}
      destination={destination as NeighborhoodPreviewContext['destination']}
      route={route}
      commuteMaxMinutes={60}
      hasDestination={hasDestination}
      onDeleted={() => undefined}
    />,
  );

describe('FinderPropertyPanel 주변 인프라', () => {
  beforeEach(() => {
    useNearbyFacilities.mockReset();
    useNearbyFacilities.mockReturnValue({
      data: nearbyData,
      isPending: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    });
  });

  it('매물 좌표 기준 500m 주변 시설 요약을 보여 준다', () => {
    renderPanel(baseProperty);
    expect(screen.getByRole('group', { name: '주변 인프라' })).toBeTruthy();
    expect(screen.getByText('편의점')).toBeTruthy();
    expect(useNearbyFacilities).toHaveBeenCalledWith({ latitude: 37.5, longitude: 127.03 }, 500, [], true, {
      loadAllCategories: true,
    });
  });

  it('상세 화면과 같은 조회 훅을 같은 인자로 불러 캐시를 공유한다', () => {
    renderPanel(baseProperty);
    const [center, radius, categories, , options] = useNearbyFacilities.mock.calls[0] ?? [];
    expect(center).toEqual({ latitude: 37.5, longitude: 127.03 });
    expect([radius, categories, options]).toEqual([500, [], { loadAllCategories: true }]);
  });

  it('출퇴근 장소를 정하기 전에도 인프라 카드는 보인다', () => {
    renderPanel(baseProperty, false);
    expect(screen.getByText('출퇴근 장소를 정하면 이 집에서 가는 노선을 알려 드려요')).toBeTruthy();
    expect(screen.getByRole('group', { name: '주변 인프라' })).toBeTruthy();
    expect(screen.getByText('편의점')).toBeTruthy();
  });

  it('행을 누르면 그 분류가 강조된다', () => {
    renderPanel(baseProperty);
    const row = screen.getByText('편의점').closest('button');
    expect(row).not.toBeNull();
    if (row === null) return;
    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('true');
  });

  it('좌표가 없는 예시 매물은 주변 정보를 계산하지 않는다고 알리고 조회하지 않는다', () => {
    renderPanel({ ...baseProperty, latitude: null, longitude: null, isPreview: true });
    expect(screen.getByText('예시 매물이라 주변 정보를 계산하지 않아요')).toBeTruthy();
    expect(useNearbyFacilities).not.toHaveBeenCalled();
  });
});
