import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isDetailCollapsed, setDetailCollapsed } from '@/shared/ui/list-detail-layout/detailCollapse';

import type { RecordsState } from '../hooks/useRecords';
import type { RecordsMapLayers } from '../hooks/useRecordsMapLayers';
import RecordsDesktopPage from './RecordsDesktopPage';

vi.mock('@/pages/property-detail/PropertyDetailPage', () => ({
  default: ({ panel }: { panel?: { headerEnd?: ReactNode } }) => <div>{panel?.headerEnd}</div>,
}));
vi.mock('@/pages/property-active-checklist/PropertyActiveChecklistPage', () => ({ default: () => null }));
vi.mock('@/features/weather/ui/map-header-weather/MapHeaderWeather', () => ({ default: () => null }));
vi.mock('./RecordsDesktopMap', () => ({ default: () => null }));
vi.mock('../ui/record-address-search/RecordAddressSearch', () => ({ default: () => null }));
vi.mock('../ui/record-districts/RecordDistricts', () => ({ default: () => null }));
vi.mock('../ui/record-notice/RecordNotice', () => ({ default: () => null }));
vi.mock('../ui/record-list/RecordList', () => ({
  default: ({ onOpen }: { onOpen: (id: string) => void }) => (
    <button type="button" onClick={() => onOpen('2')}>
      목록 카드
    </button>
  ),
}));
vi.mock('../ui/record-stepper/RecordStepper', () => ({
  default: ({ onStep }: { onStep: (id: string) => void }) => (
    <button type="button" onClick={() => onStep('3')}>
      다음 매물
    </button>
  ),
}));

const showRecordOnMap = vi.fn();

const renderPage = () => {
  const records = {
    properties: { isPending: false, isError: false },
    records: [{ id: '1' }, { id: '2' }, { id: '3' }],
    district: '전체',
    districts: [],
    districtCounts: {},
    selected: { id: '1' },
    setSelectedId: vi.fn(),
    setNotice: vi.fn(),
    showRecordOnMap,
    notice: '',
    headingRef: { current: null },
  } as unknown as RecordsState;
  const layers = { groupRecords: [] } as unknown as RecordsMapLayers;
  render(
    <MemoryRouter>
      <RecordsDesktopPage records={records} layers={layers} />
    </MemoryRouter>,
  );
};

describe('RecordsDesktopPage 상세 패널 접힘', () => {
  beforeEach(() => {
    localStorage.clear();
    showRecordOnMap.mockReset();
  });
  afterEach(() => {
    act(() => setDetailCollapsed(false));
  });

  it('접어 둔 상태에서 목록 카드를 누르면 펼치고 그 매물로 간다', () => {
    setDetailCollapsed(true);
    renderPage();
    act(() => screen.getByRole('button', { name: '목록 카드' }).click());
    expect(isDetailCollapsed()).toBe(false);
    expect(showRecordOnMap).toHaveBeenCalledWith('2');
  });

  it('이미 펼쳐 있으면 그대로 둔다', () => {
    renderPage();
    act(() => screen.getByRole('button', { name: '목록 카드' }).click());
    expect(isDetailCollapsed()).toBe(false);
    expect(showRecordOnMap).toHaveBeenCalledWith('2');
  });

  it('이전, 다음 버튼은 접힘을 풀지 않고 매물만 옮긴다', () => {
    setDetailCollapsed(true);
    renderPage();
    act(() => screen.getByRole('button', { name: '다음 매물', hidden: true }).click());
    expect(isDetailCollapsed()).toBe(true);
    expect(showRecordOnMap).toHaveBeenCalledWith('3');
  });

  it('이전, 다음 버튼은 펼친 상태를 그대로 둔다', () => {
    renderPage();
    act(() => screen.getByRole('button', { name: '다음 매물' }).click());
    expect(isDetailCollapsed()).toBe(false);
    expect(showRecordOnMap).toHaveBeenCalledWith('3');
  });
});
