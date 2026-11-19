import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import { createStreetMemoHandlers } from '@/app/mocks/handlers/streetMemoHandlers';
import { getMockProperties, propertyListItemResponse, success } from '@/app/mocks/mockStore';
import DesignRecordsPage from '@/pages/design-records/DesignRecordsPage';
import { recordNeighbors } from '@/pages/design-records/model/recordNavigation';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: ({ center, markers, selectedMarkerId, onSelectMarker, onSelectLocation }: MapCanvasProps) => (
    <div aria-label="예시 지도">
      <output aria-label="지도 중심">{`${center.latitude},${center.longitude}`}</output>
      {markers?.map((marker) => (
        <button
          key={marker.id}
          type="button"
          aria-pressed={marker.id === selectedMarkerId}
          onClick={() => onSelectMarker?.(marker)}
        >
          {marker.label}
        </button>
      ))}
      <button type="button" onClick={() => onSelectLocation?.(37.5662, 126.9785)}>
        빈 곳 찍기
      </button>
    </div>
  ),
}));

const INTRO_SEEN_KEY = 'jachwi:records-map-intro-seen';

beforeEach(() => {
  localStorage.setItem(INTRO_SEEN_KEY, 'true');
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(...propertyHandlers, ...mapHandlers, ...createStreetMemoHandlers());
});
afterEach(() => {
  localStorage.removeItem(INTRO_SEEN_KEY);
  resetAuthenticationForTests();
  queryClient.clear();
  sessionStorage.clear();
});

/** 지도에서 서로 떨어진 매물 셋. 휴대폰 시트는 상세를 받지 않아 목록만 바꿔도 된다. */
const useThreeRecords = () => {
  const [base] = getMockProperties();
  const items = [
    { ...base, id: 9101, name: '첫째 방', latitude: 37.5, longitude: 126.9 },
    { ...base, id: 9102, name: '둘째 방', latitude: 37.6, longitude: 127.0 },
    { ...base, id: 9103, name: '셋째 방', latitude: 37.7, longitude: 127.1 },
  ];
  server.use(
    http.get('*/api/properties', () =>
      success({ totalCount: items.length, items: items.map(propertyListItemResponse) }),
    ),
  );
};

const renderRecords = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            {/* 앱처럼 한 화면 셸을 두 주소(홈과 매물 상세)가 함께 쓴다. */}
            <Route element={<DesignRecordsPage />}>
              <Route path="/" />
              <Route path="/properties/:propertyId" />
            </Route>
          </Routes>
        </MemoryRouter>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );

const useDesktopViewport = () =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(min-width: 1024px)',
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );

it('앞뒤 매물은 목록 순서를 따르고 처음과 마지막에서는 그쪽이 없다', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  expect(recordNeighbors(list, 'a')).toEqual({ previous: null, next: { id: 'b' }, position: 1, total: 3 });
  expect(recordNeighbors(list, 'b')).toEqual({ previous: { id: 'a' }, next: { id: 'c' }, position: 2, total: 3 });
  expect(recordNeighbors(list, 'c')).toEqual({ previous: { id: 'b' }, next: null, position: 3, total: 3 });
  expect(recordNeighbors(list, 'x')).toBeNull();
  expect(recordNeighbors(list, null)).toBeNull();
});

it('휴대폰에서 매물 뱃지를 고르면 바텀시트로 보고, 이전 다음으로 넘기면 뱃지 선택이 따라간다', async () => {
  useThreeRecords();
  const user = userEvent.setup();
  renderRecords();
  await screen.findByRole('button', { name: '첫째 방' });
  const map = within(screen.getByLabelText('예시 지도'));
  await user.click(map.getByRole('button', { name: '첫째 방' }));

  const sheet = within(screen.getByRole('region', { name: '선택한 매물' }));
  expect(sheet.getByRole('link', { name: '첫째 방' })).toBeInTheDocument();
  expect(sheet.getByRole('button', { name: '이전 매물' })).toBeDisabled();
  expect(sheet.getByText('3개 중 1번째')).toBeInTheDocument();

  await user.click(sheet.getByRole('button', { name: '다음 매물' }));
  expect(sheet.getByRole('link', { name: '둘째 방' })).toBeInTheDocument();
  // 이전, 다음으로 넘겨도 목록 카드를 눌렀을 때처럼 지도를 그 매물로 옮긴다.
  expect(screen.getByLabelText('지도 중심')).toHaveTextContent('37.6,127');
  expect(map.getByRole('button', { name: '둘째 방' })).toHaveAttribute('aria-pressed', 'true');
  expect(map.getByRole('button', { name: '첫째 방' })).toHaveAttribute('aria-pressed', 'false');

  await user.click(sheet.getByRole('button', { name: '다음 매물' }));
  expect(sheet.getByRole('link', { name: '셋째 방' })).toBeInTheDocument();
  expect(sheet.getByRole('button', { name: '다음 매물' })).toBeDisabled();

  await user.click(sheet.getByRole('button', { name: '이전 매물' }));
  expect(sheet.getByRole('link', { name: '둘째 방' })).toBeInTheDocument();

  // 바깥(지도 빈 곳)을 누르면 시트를 닫고 선택을 푼다. 말풍선은 띄우지 않는다.
  await user.click(map.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.queryByRole('region', { name: '선택한 매물' })).not.toBeInTheDocument();
  expect(map.getByRole('button', { name: '둘째 방' })).toHaveAttribute('aria-pressed', 'false');
});

it('데스크탑 상세 칸에서도 이전 다음으로 리스트 순서대로 넘기고 지도를 그 매물로 옮긴다', async () => {
  const matchMedia = useDesktopViewport();
  const user = userEvent.setup();
  try {
    renderRecords();
    // 기본 목록은 망원동 투룸, 신림역 원룸 순서다.
    await screen.findByRole('button', { name: '신림역 원룸' });
    // 상세 칸에도 주변 지도가 하나 더 생기므로, 상세를 열기 전에 본 방 기록 지도를 잡아 둔다.
    const map = within(screen.getByLabelText('예시 지도'));
    await user.click(map.getByRole('button', { name: '신림역 원룸' }));
    let detail = within(screen.getByRole('complementary', { name: '선택한 매물 상세' }));
    await detail.findByRole('heading', { level: 1, name: '신림역 원룸' });
    expect(detail.getByRole('button', { name: '다음 매물' })).toBeDisabled();

    await user.click(detail.getByRole('button', { name: '이전 매물' }));
    detail = within(screen.getByRole('complementary', { name: '선택한 매물 상세' }));
    expect(await detail.findByRole('heading', { level: 1, name: '망원동 투룸' })).toBeInTheDocument();
    expect(detail.getByRole('button', { name: '이전 매물' })).toBeDisabled();
    expect(map.getByLabelText('지도 중심')).toHaveTextContent('37.5551234,126.9101234');
    expect(map.getByRole('button', { name: '망원동 투룸' })).toHaveAttribute('aria-pressed', 'true');
  } finally {
    matchMedia.mockRestore();
  }
});
