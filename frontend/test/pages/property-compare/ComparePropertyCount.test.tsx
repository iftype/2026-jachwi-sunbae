import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import CompareDesktopPage from '@/pages/property-compare/desktop/CompareDesktopPage';
import CompareMobilePage from '@/pages/property-compare/mobile/CompareMobilePage';
import type { PropertySummary } from '@/features/property/model/Property';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

const { listQuery } = vi.hoisted(() => ({ listQuery: { current: null as unknown } }));
vi.mock('@/features/property/api/useProperties', () => ({ usePropertyList: () => listQuery.current }));
vi.mock('@/features/property/api/usePropertyMutations', () => ({
  useRecordPropertyComparisonView: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: vi.fn() }));
vi.mock('@/features/property/ui/authenticated-photo/AuthenticatedPhoto', () => ({ default: () => null }));

const progress = {
  totalCount: 0,
  completedCount: 0,
  goodCount: 0,
  cautionCount: 0,
  unconfirmedCount: 0,
  progressRate: 0,
};
const property = (propertyId: number, name: string): PropertySummary => ({
  propertyId,
  name,
  depositAmount: 1000,
  monthlyRentAmount: 50,
  discoverySource: { type: 'TEXT', value: '' },
  location: { address: null, latitude: null, longitude: null },
  representativePhoto: null,
  progress,
  stages: [],
  photoCount: 0,
});

const withProperties = (content: PropertySummary[]) => {
  listQuery.current = {
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    data: { pages: [{ content, page: 0, size: 20, totalElements: content.length, totalPages: 1, hasNext: false }] },
  };
};

const renderPage = (Page: typeof CompareMobilePage) =>
  render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    </PublicConfigProvider>,
  );

describe.each([
  ['휴대폰', CompareMobilePage],
  ['데스크탑', CompareDesktopPage],
])('%s 비교 화면의 매물 수별 모습', (_, Page) => {
  it('체크 진행은 단계 이름 없이 적용된 전체 항목 수로 합산한다', () => {
    const room = property(1, '합산 확인 매물');
    room.stages = [
      {
        stage: 'ON_SITE',
        applied: true,
        propertyChecklistId: 1,
        checklistName: '현장',
        sourceChecklistId: null,
        progress: { ...progress, totalCount: 12, completedCount: 4 },
      },
      {
        stage: 'PRE_CONTRACT',
        applied: true,
        propertyChecklistId: 2,
        checklistName: '계약',
        sourceChecklistId: null,
        progress: { ...progress, totalCount: 3, completedCount: 1 },
      },
    ];
    withProperties([room]);
    renderPage(Page);
    expect(screen.getByLabelText('전체 15개 중 5개 확인')).toHaveTextContent('5/15');
    expect(screen.queryByText(/단계/)).not.toBeInTheDocument();
  });

  it('매물이 없으면 빈 화면 안내만 보이고 아래 바는 없다', () => {
    withProperties([]);
    renderPage(Page);

    expect(screen.getByText('PDF로 받을 매물이 아직 없어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PDF 받기/ })).not.toBeInTheDocument();
  });

  it('매물이 1개여도 그 매물을 보이고, 골라서 PDF로 받을 수 있다', async () => {
    withProperties([property(1, '성수동 투룸')]);
    renderPage(Page);
    const user = userEvent.setup();

    expect(screen.getByText('성수동 투룸')).toBeInTheDocument();
    expect(screen.queryByText('PDF로 받을 매물이 아직 없어요.')).not.toBeInTheDocument();
    const download = within(screen.getByRole('main')).getByRole('button', { name: /PDF 받기/ });
    expect(download).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /성수동 투룸/ }));
    expect(within(screen.getByRole('main')).getByRole('button', { name: '선택한 1개 PDF 받기' })).toBeEnabled();
  });

  it('매물이 2개 이상이면 목록과 PDF 받기 버튼을 보인다', () => {
    withProperties([property(1, '성수동 투룸'), property(2, '망원동 원룸')]);
    renderPage(Page);

    expect(screen.getByText('성수동 투룸')).toBeInTheDocument();
    expect(screen.getByText('망원동 원룸')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('button', { name: /PDF 받기/ })).toBeDisabled();
    expect(screen.getByText('PDF로 받을 매물을 골라 주세요.')).toBeInTheDocument();
  });
});
