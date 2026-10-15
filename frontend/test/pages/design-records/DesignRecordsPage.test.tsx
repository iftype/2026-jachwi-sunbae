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
  default: ({ markers }: MapCanvasProps) => (
    <div aria-label="예시 지도">
      {markers?.map((marker) => (
        <span key={marker.id}>{marker.label}</span>
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
        <MemoryRouter initialEntries={['/design-preview/records']}>
          <Routes>
            <Route path="/design-preview/records" element={<DesignRecordsPage />} />
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
  expect(within(screen.getByRole('navigation', { name: '기록 보기 방식' })).getByRole('button', { name: /지도/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/design-preview');
  await user.click(screen.getByRole('button', { name: /리스트/ }));
  expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /망원동 투룸/ })).toHaveAttribute('href', expect.stringMatching(/^\/properties\/\d+$/));
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
