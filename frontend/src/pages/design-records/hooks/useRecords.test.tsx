import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { PropertySummary } from '@/features/property/model/Property';

import useRecords from './useRecords';

const property = (propertyId: number, latitude: number, longitude: number): PropertySummary => ({
  propertyId,
  name: `매물 ${propertyId}`,
  depositAmount: 1000,
  monthlyRentAmount: 50,
  discoverySource: { type: 'TEXT', value: '직접' },
  location: { address: '서울 마포구 합정동 1', latitude, longitude },
  representativePhoto: null,
  progress: { totalCount: 0, completedCount: 0, goodCount: 0, cautionCount: 0, unconfirmedCount: 0, progressRate: 0 },
  stages: [],
  photoCount: 0,
});

const mockProperties = vi.hoisted(() => ({ list: [] as PropertySummary[] }));

vi.mock('@/features/property/api/useProperties', () => ({
  usePropertyList: () => ({
    data: { pages: [{ content: mockProperties.list }] },
    isSuccess: true,
    isPending: false,
    isError: false,
  }),
}));
vi.mock('@/features/property/hooks/usePropertyMarkerPhotos', () => ({ default: () => new Map() }));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe('useRecords showRecordOnMap', () => {
  it('리스트에서 매물을 고르면 지도 중심이 그 매물 좌표로 옮겨지고 확대 단계는 그대로다', () => {
    mockProperties.list = [property(1, 37.55, 126.91), property(2, 37.5, 127.03)];
    const { result } = renderHook(() => useRecords(), { wrapper });
    const level = result.current.level;

    act(() => result.current.showRecordOnMap('2'));

    expect(result.current.selected?.id).toBe('2');
    expect(result.current.center).toEqual({ latitude: 37.5, longitude: 127.03 });
    expect(result.current.level).toBe(level);
  });

  it('이미 그 자리면 중심 객체를 바꾸지 않는다', () => {
    mockProperties.list = [property(1, 37.55, 126.91), property(2, 37.5, 127.03)];
    const { result } = renderHook(() => useRecords(), { wrapper });

    act(() => result.current.showRecordOnMap('2'));
    const first = result.current.center;
    act(() => result.current.showRecordOnMap('2'));

    expect(result.current.center).toBe(first);
  });
});
