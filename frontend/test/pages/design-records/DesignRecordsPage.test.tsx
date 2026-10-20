import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import DesignRecordsPage from '@/pages/design-records/DesignRecordsPage';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: ({ markers, onSelectMarker }: MapCanvasProps) => (
    <div aria-label="예시 지도">
      {markers?.map((marker) => (
        <button key={marker.id} type="button" onClick={() => onSelectMarker?.(marker)}>
          {marker.label}
        </button>
      ))}
    </div>
  ),
}));

beforeEach(() => {
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(...propertyHandlers);
});
afterEach(() => {
  resetAuthenticationForTests();
  queryClient.clear();
});

const renderRecords = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <MemoryRouter initialEntries={['/properties']}>
          <Routes>
            <Route path="/properties/:propertyId?" element={<DesignRecordsPage />} />
            <Route path="/properties/new" element={<h1>매물 등록 화면</h1>} />
          </Routes>
        </MemoryRouter>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );

it('내 매물로 지도·리스트와 주소 필터를 구성하고 홈으로 돌아가는 링크를 둔다', async () => {
  const user = userEvent.setup();
  renderRecords();
  expect(await screen.findByText('신림역 원룸')).toBeInTheDocument();
  expect(
    within(screen.getByRole('navigation', { name: '기록 보기 방식' })).getByRole('button', { name: /지도/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
  await user.click(screen.getByRole('button', { name: /리스트/ }));
  expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /망원동 투룸/ })).toHaveAttribute(
    'href',
    expect.stringMatching(/^\/properties\/\d+$/),
  );
  const districts = within(screen.getByRole('navigation', { name: '기록한 동네' }));
  await user.click(districts.getByRole('button', { name: '관악구' }));
  expect(screen.getByRole('heading', { name: '관악구 기록' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /망원동 투룸/ })).not.toBeInTheDocument();
});

it('기록하기는 기존 매물 등록 화면으로 이동한다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(screen.getByRole('button', { name: /기록하기/ }));
  expect(screen.getByRole('heading', { name: '매물 등록 화면' })).toBeInTheDocument();
});

it('리스트 메뉴의 삭제는 실제 매물 삭제 API를 호출한다', async () => {
  const user = userEvent.setup();
  const removed = vi.fn();
  server.use(
    http.delete('*/api/properties/:propertyId', ({ params }) => {
      removed(params.propertyId);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(screen.getByRole('button', { name: /리스트/ }));
  await user.click(screen.getByRole('button', { name: '망원동 투룸 메뉴' }));
  await user.click(screen.getByRole('button', { name: /삭제/ }));
  expect(await screen.findByText('기록을 삭제했어요.')).toBeInTheDocument();
  expect(removed).toHaveBeenCalledTimes(1);
});

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

it('데스크탑에서는 보기 전환 없이 지도와 리스트를 함께 보여준다', async () => {
  const matchMedia = useDesktopViewport();
  renderRecords();
  expect(await screen.findByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: '본 방 기록' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: '기록 보기 방식' })).not.toBeInTheDocument();
  matchMedia.mockRestore();
});

it('데스크탑의 기록하기는 화면을 넘기지 않고 리스트 자리에 매물 등록을 열고 닫는다', async () => {
  const matchMedia = useDesktopViewport();
  const user = userEvent.setup();
  renderRecords();
  await screen.findByRole('heading', { name: '모든 기록' });
  await user.click(screen.getByRole('button', { name: /기록하기/ }));
  const panel = within(screen.getByRole('complementary', { name: '새 매물 등록 패널' }));
  expect(panel.getByRole('heading', { name: '새 매물 등록' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '모든 기록' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '매물 등록 화면' })).not.toBeInTheDocument();
  await user.click(panel.getByRole('button', { name: '매물 등록 닫기' }));
  expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  matchMedia.mockRestore();
});

it('데스크탑에서 지도나 리스트의 방을 누르면 리스트 자리에 매물 상세를 보여주고 목록으로 돌아간다', async () => {
  const matchMedia = useDesktopViewport();
  const user = userEvent.setup();
  renderRecords();
  await screen.findByRole('heading', { name: '모든 기록' });

  await user.click(within(screen.getByLabelText('예시 지도')).getByRole('button', { name: '신림역 원룸' }));
  const detail = within(screen.getByRole('complementary', { name: '선택한 매물 상세' }));
  expect(await detail.findByRole('heading', { level: 1, name: '신림역 원룸' })).toBeInTheDocument();
  expect(detail.getByRole('tablist', { name: '매물 상세 메뉴' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '모든 기록' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '매물 카드 닫기' })).not.toBeInTheDocument();

  await user.click(detail.getByRole('button', { name: '목록으로 돌아가기' }));
  await user.click(screen.getByRole('link', { name: /망원동 투룸/ }));
  expect(
    await within(screen.getByRole('complementary', { name: '선택한 매물 상세' })).findByRole('heading', {
      level: 1,
      name: '망원동 투룸',
    }),
  ).toBeInTheDocument();
  matchMedia.mockRestore();
});
