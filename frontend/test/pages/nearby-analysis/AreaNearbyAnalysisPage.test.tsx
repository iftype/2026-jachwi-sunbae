import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

import NearbyAnalysisPage from '@/pages/nearby-analysis/NearbyAnalysisPage';
import { resetAuthenticationForTests } from '@/features/auth/model/authStore';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: (props: MapCanvasProps) => (
    <output aria-label="주변 지도 마커">{JSON.stringify(props.markers?.map((marker) => marker.label))}</output>
  ),
}));

const success = (data: unknown) => HttpResponse.json({ code: 'SUCCESS', message: '성공', data });
const requests: { path: string; authorization: string | null }[] = [];

beforeEach(() => {
  requests.length = 0;
  resetAuthenticationForTests();
  server.use(
    http.get('*/api/maps/nearby', ({ request }) => {
      const url = new URL(request.url);
      requests.push({ path: url.pathname, authorization: request.headers.get('Authorization') });
      return success({
        center: { latitude: 37.5006, longitude: 127.0364 },
        radius: Number(url.searchParams.get('radius')),
        counts: { HOSPITAL: 1, SCHOOL: 0, CONVENIENCE: 0, AGENCY: 1 },
        places: [
          {
            providerPlaceId: 'agency-1',
            name: '역삼공인중개사',
            latitude: 37.501,
            longitude: 127.037,
            distanceMeters: 120,
            category: 'AGENCY',
            address: '서울 강남구',
          },
          {
            providerPlaceId: 'hospital-1',
            name: '역삼내과',
            latitude: 37.502,
            longitude: 127.035,
            distanceMeters: 200,
            category: 'HOSPITAL',
            address: '서울 강남구',
          },
        ],
      });
    }),
    http.get('*/api/maps/bus-stops', ({ request }) => {
      requests.push({ path: new URL(request.url).pathname, authorization: request.headers.get('Authorization') });
      return success({
        center: { latitude: 37.5006, longitude: 127.0364 },
        radius: Number(new URL(request.url).searchParams.get('radius')),
        count: 1,
        busStops: [{ nodeId: 'stop-1', name: '역삼역', latitude: 37.5007, longitude: 127.0365, distanceMeters: 80 }],
      });
    }),
  );
});

const show = (path: string) =>
  render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', commuteDataSource: 'mock' }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/explore/nearby" element={<NearbyAnalysisPage />} />
            <Route path="/explore/commute" element={<h1>통근 동네 지도</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>,
  );

it('토큰이 없으면 자동 로그인한 뒤 동네 좌표로 정류장과 공인중개사를 먼저 보여준다', async () => {
  show(
    '/explore/nearby?latitude=37.5006&longitude=127.0364&name=%EC%97%AD%EC%82%BC1%EB%8F%99&backTo=%2Fexplore%2Fcommute',
  );
  expect(await screen.findByRole('region', { name: '역삼1동 주변 2km' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /시설 목록 보기/ }));
  const list = screen.getByRole('list', { name: '주변 시설 목록' });
  expect(list).toHaveTextContent('역삼역');
  expect(list).toHaveTextContent('역삼공인중개사');
  expect(list).not.toHaveTextContent('역삼내과');
  expect(screen.getByLabelText('주변 지도 마커')).toHaveTextContent('역삼1동');
  expect(requests.map((request) => request.path).sort()).toEqual(['/api/maps/bus-stops', '/api/maps/nearby']);
  expect(requests.every((request) => request.authorization === 'Bearer test-auto-login-token')).toBe(true);
});

it('뒤로 가기는 넘겨받은 동네 지도로 돌아간다', async () => {
  show(
    '/explore/nearby?latitude=37.5006&longitude=127.0364&name=%EC%97%AD%EC%82%BC1%EB%8F%99&backTo=%2Fexplore%2Fcommute',
  );
  await userEvent.click(screen.getByRole('link', { name: '동네 지도로 돌아가기' }));
  expect(await screen.findByRole('heading', { name: '통근 동네 지도' })).toBeInTheDocument();
});

it('좌표 없이 들어오면 동네 지도로 돌아가는 안내를 보여준다', () => {
  show('/explore/nearby');
  expect(screen.getByText('동네 위치를 찾지 못했어요')).toBeInTheDocument();
  expect(requests).toHaveLength(0);
});
