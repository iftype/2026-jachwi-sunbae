import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { expect, it, vi } from 'vitest';

import { propertySummaryFixture } from '@/app/mocks/fixtures/propertyFixtures';
import MapPage from '@/pages/map/MapPage';
import { setAuthentication } from '@/features/auth/model/authStore';
import { getMapFocusCenter } from '@/features/map/lib/mapViewportFocus';
import type MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import { getPropertyReturnState } from '@/features/property/lib/propertyNavigation';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: (props: React.ComponentProps<typeof MapCanvas>) => (
    <div>
      <output aria-label="조회 기준">{JSON.stringify(props.radiusCenter)}</output>
      <output aria-label="지도 확대 수준">{props.level}</output>
      <output aria-label="지도 중심">{JSON.stringify(props.center)}</output>
      <output aria-label="선택 매물">{props.selectedMarkerId}</output>
      <button onClick={() => props.onCenterChange?.(37.5, 127.1)}>지도 이동</button>
      {props.markers
        ?.filter((marker) => marker.tone === 'property')
        .map((marker) => (
          <button key={marker.id} onClick={() => props.onSelectMarker?.(marker)}>
            매물 선택
          </button>
        ))}
    </div>
  ),
}));

const ReturnToMap = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <Link to="/map" state={getPropertyReturnState(state)}>
        지도로 복귀
      </Link>
      <button onClick={() => navigate(-1)}>브라우저 뒤로</button>
    </>
  );
};

it('주소 검색을 열고 닫아도 같은 지도 요소와 위치를 유지한다', async () => {
  server.use(
    http.get('*/api/properties', () => HttpResponse.json({ code: 'SUCCESS', data: { totalCount: 0, items: [] } })),
  );
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/map', key: 'map-search-lifecycle-test' }]}>
        <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' }}>
          <MapPage />
        </PublicConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const map = screen.getByRole('region', { name: '매물 지도' });
  const center = screen.getByLabelText('지도 중심').textContent;
  await user.click(screen.getByRole('button', { name: '주소 또는 위치 검색' }));
  expect(screen.getByLabelText('매물 지도')).toBe(map);
  expect(map).toHaveAttribute('inert');
  expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(screen.getByRole('region', { name: '매물 지도' })).toBe(map);
  expect(map).not.toHaveAttribute('inert');
  expect(screen.getByLabelText('지도 중심')).toHaveTextContent(center!);
  client.clear();
});

it('추가 버튼은 그대로 두고 손잡이 클릭은 목록 열기와 닫기만 전환한다', async () => {
  server.use(
    http.get('*/api/properties', () => HttpResponse.json({ code: 'SUCCESS', data: { totalCount: 0, items: [] } })),
  );
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/map', key: 'map-controls-test' }]}>
        <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' }}>
          <MapPage />
        </PublicConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('button', { name: '지도에서 매물 추가' })).toBeInTheDocument();
  const handle = screen.getByRole('button', { name: '지도 위 매물 목록 열기' });
  fireEvent.pointerDown(handle, { clientY: 600, pointerId: 1 });
  expect(screen.getByRole('button', { name: '지도에서 매물 추가' })).toBeInTheDocument();
  fireEvent.pointerCancel(handle, { pointerId: 1 });
  expect(screen.getByRole('button', { name: '지도에서 매물 추가' })).toBeInTheDocument();
  await user.click(handle);
  expect(screen.getByRole('button', { name: '지도에서 매물 추가' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '지도 위 매물 목록 닫기' }));
  expect(screen.getByRole('button', { name: '지도 위 매물 목록 열기' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: '지도에서 매물 추가' })).toBeInTheDocument();
  client.clear();
});

it('최초 반경 선택은 막고 활성화 후에는 반경에 맞춰 확대 수준만 변경한다', async () => {
  server.use(
    http.get('*/api/properties', () => HttpResponse.json({ code: 'SUCCESS', data: { totalCount: 0, items: [] } })),
    http.get('*/api/maps/nearby', () => HttpResponse.json({ code: 'SUCCESS', data: { counts: {}, places: [] } })),
  );
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/map', key: 'map-radius-test' }]}>
        <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' }}>
          <MapPage />
        </PublicConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const initialAnchor = screen.getByLabelText('조회 기준').textContent;
  const initialLevel = screen.getByLabelText('지도 확대 수준').textContent;
  expect(screen.getByRole('button', { name: '500m' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '1km' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '2km' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '지도 이동' }));
  await user.click(screen.getByRole('button', { name: '500m' }));
  await user.click(screen.getByRole('button', { name: '2km' }));
  expect(screen.getByLabelText('조회 기준')).toHaveTextContent(initialAnchor!);
  expect(screen.getByLabelText('지도 확대 수준')).toHaveTextContent(initialLevel!);
  const radiusClassName = screen.getByLabelText('시설 확인 반경').className;
  await user.click(screen.getByRole('button', { name: '지도에서 매물 추가' }));
  expect(screen.getByLabelText('시설 확인 반경')).toHaveAttribute('class', radiusClassName);
  expect(screen.queryByText('중앙 핀 기준으로 주변 시설을 확인해 보세요.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '500m' })).toBeEnabled();
  expect(screen.getByLabelText('조회 기준')).toHaveTextContent(JSON.stringify({ latitude: 37.5, longitude: 127.1 }));
  await user.click(screen.getByRole('button', { name: '1km' }));
  expect(screen.getByLabelText('지도 확대 수준')).toHaveTextContent('6');
  await user.click(screen.getByRole('button', { name: '2km' }));
  expect(screen.getByLabelText('지도 확대 수준')).toHaveTextContent('7');
  await user.click(screen.getByRole('button', { name: '500m' }));
  expect(screen.getByLabelText('지도 확대 수준')).toHaveTextContent('5');
  expect(screen.getByLabelText('조회 기준')).toHaveTextContent(JSON.stringify({ latitude: 37.5, longitude: 127.1 }));
  await user.click(screen.getByRole('button', { name: '500m' }));
  expect(screen.getByLabelText('지도 확대 수준')).toHaveTextContent('5');
  await user.click(screen.getByRole('button', { name: '지도 이동' }));
  client.clear();
});

it('선택 매물의 반경을 바꾸면 새 확대 수준에서 매물을 기준으로 지도 중심도 이동한다', async () => {
  setAuthentication({ accessToken: 'demo-token', tokenType: 'Bearer', expiresIn: 60 });
  const coordinate = { latitude: 37.5, longitude: 127.1 };
  server.use(
    http.get('*/api/properties', () =>
      HttpResponse.json({
        code: 'SUCCESS',
        message: '요청에 성공했습니다.',
        data: {
          totalCount: 1,
          items: [
            {
              ...propertySummaryFixture,
              id: propertySummaryFixture.propertyId,
              ...coordinate,
              address: '테스트 주소',
              discoverySource: '데모 지도',
              overallProgress: propertySummaryFixture.progress,
              stages: [],
              photoCount: 0,
              representativePhoto: null,
              location: { ...coordinate, address: '테스트 주소' },
            },
          ],
        },
      }),
    ),
    http.get('*/api/maps/nearby', () => HttpResponse.json({ code: 'SUCCESS', data: { counts: {}, places: [] } })),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/map', key: 'map-return-test' }]}>
        <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' }}>
          <Routes>
            <Route path="/map" element={<MapPage />} />
            <Route path="/properties/:propertyId" element={<ReturnToMap />} />
          </Routes>
        </PublicConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole('button', { name: '지도 이동' }));
  await user.click(await screen.findByRole('button', { name: '매물 선택' }));
  await user.click(screen.getByRole('button', { name: '지도 이동' }));
  await user.click(screen.getByRole('button', { name: '2km' }));
  expect(screen.getByLabelText('지도 중심')).toHaveTextContent(
    JSON.stringify(getMapFocusCenter(coordinate, 7, 390, 640)),
  );
  expect(screen.getByLabelText('조회 기준')).toHaveTextContent(JSON.stringify(coordinate));
  await user.click(screen.getByRole('button', { name: '500m' }));
  expect(screen.getByLabelText('지도 중심')).toHaveTextContent(
    JSON.stringify(getMapFocusCenter(coordinate, 5, 390, 640)),
  );
  const centerBeforeDetail = screen.getByLabelText('지도 중심').textContent;
  await user.click(screen.getByRole('button', { name: /병원 표시하기/ }));
  await user.click(screen.getByRole('link', { name: propertySummaryFixture.name }));
  await user.click(screen.getByRole('link', { name: '지도로 복귀' }));
  expect(screen.getByLabelText('선택 매물')).toHaveTextContent(`property-${propertySummaryFixture.propertyId}`);
  expect(screen.getByLabelText('지도 중심')).toHaveTextContent(centerBeforeDetail!);
  expect(screen.getByLabelText('지도 확대 수준')).toHaveTextContent('5');
  expect(screen.getByRole('button', { name: '500m' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /병원 숨기기/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '지도 위 매물 목록 닫기' })).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByRole('link', { name: propertySummaryFixture.name }));
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));
  expect(screen.getByLabelText('선택 매물')).toHaveTextContent(`property-${propertySummaryFixture.propertyId}`);
  expect(screen.getByLabelText('지도 중심')).toHaveTextContent(centerBeforeDetail!);
  client.clear();
});
