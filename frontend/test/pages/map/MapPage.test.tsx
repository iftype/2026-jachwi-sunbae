import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { expect, it, vi } from 'vitest';

import { propertySummaryFixture } from '@/app/mocks/fixtures/propertyFixtures';
import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { createStreetMemoHandlers } from '@/app/mocks/handlers/streetMemoHandlers';
import MapPage from '@/pages/map/MapPage';
import { setAuthentication } from '@/features/auth/model/authStore';
import * as mapLocation from '@/features/map/lib/mapLocation';
import { getMapFocusCenter } from '@/features/map/lib/mapViewportFocus';
import type MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import { getPropertyReturnState } from '@/features/property/lib/propertyNavigation';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

it.each([true, false])('첫 진입 현재 위치 수신 성공 여부 %s에 따라 반경을 활성화한다', async (succeeds) => {
  const permission = vi.spyOn(mapLocation, 'readGeolocationPermission').mockResolvedValue('granted');
  const position = vi.spyOn(mapLocation, 'requestCurrentMapLocation');
  if (succeeds) position.mockResolvedValue({ latitude: 37.5, longitude: 127.1 });
  else position.mockRejectedValue(new Error('위치 조회 실패'));
  server.use(
    http.get('*/api/properties', () => HttpResponse.json({ code: 'SUCCESS', data: { totalCount: 0, items: [] } })),
    http.get('*/api/maps/nearby', () =>
      HttpResponse.json({
        code: 'SUCCESS',
        data: {
          center: { latitude: 37.5, longitude: 127.1 },
          radius: 500,
          counts: { HOSPITAL: 0, SCHOOL: 0, CONVENIENCE: 0, AGENCY: 0 },
          places: [],
        },
      }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/map', key: `gps-${succeeds}` }]}>
        <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' }}>
          <MapPage />
        </PublicConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  try {
    await waitFor(() => expect(position).toHaveBeenCalledTimes(1));
    if (succeeds) {
      await waitFor(() => expect(screen.getByRole('button', { name: '500m' })).toHaveAttribute('aria-pressed', 'true'));
      expect(screen.getByRole('button', { name: '1km' })).toBeEnabled();
      expect(screen.getByLabelText('조회 기준')).toHaveTextContent(
        JSON.stringify({ latitude: 37.5, longitude: 127.1 }),
      );
    } else {
      expect(screen.getByRole('button', { name: '500m' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '500m' })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(screen.getByLabelText('지도 확대 수준')).toHaveTextContent('5');
  } finally {
    view.unmount();
    client.clear();
    permission.mockRestore();
    position.mockRestore();
  }
});

vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: (props: React.ComponentProps<typeof MapCanvas>) => (
    <div>
      <output aria-label="조회 기준">{JSON.stringify(props.radiusCenter)}</output>
      <output aria-label="지도 확대 수준">{props.level}</output>
      <output aria-label="지도 중심">{JSON.stringify(props.center)}</output>
      <output aria-label="선택 매물">{props.selectedMarkerId}</output>
      <button onClick={() => props.onCenterChange?.(37.5, 127.1)}>지도 이동</button>
      <button onClick={() => props.onSelectLocation?.(37.5662, 126.9785)}>빈 곳 찍기</button>
      <button onClick={() => props.onBoundsChange?.({ south: 37.56, west: 126.97, north: 37.57, east: 126.99 })}>
        화면 범위 알림
      </button>
      {props.coordinateMenu?.actions.map((action) => (
        <button key={action.id} onClick={action.onSelect}>
          {`말풍선 ${action.label}`}
        </button>
      ))}
      {props.markers
        ?.filter((marker) => marker.category === 'MEMO')
        .map((marker) => (
          <button key={marker.id} onClick={() => props.onSelectMarker?.(marker)}>
            {`메모 마커 ${marker.label}`}
          </button>
        ))}
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
            <Route path="/map/:propertyId" element={<ReturnToMap />} />
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

const renderMemoMap = () => {
  vi.spyOn(mapLocation, 'readGeolocationPermission').mockResolvedValue('prompt');
  server.use(
    http.get('*/api/properties', () => HttpResponse.json({ code: 'SUCCESS', data: { totalCount: 0, items: [] } })),
    ...mapHandlers,
    ...createStreetMemoHandlers(),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/map', key: 'memo' }]}>
        <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' }}>
          <Routes>
            <Route path="/map" element={<MapPage />} />
          </Routes>
        </PublicConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

it('메모 탭을 켜면 화면 안 거리 메모를 올리고, 남의 메모는 내용만 보고 지울 수 없다', async () => {
  const user = userEvent.setup();
  renderMemoMap();
  await user.click(screen.getByRole('button', { name: '화면 범위 알림' }));
  expect(screen.queryByRole('button', { name: /^메모 마커/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^거리 메모 표시하기/ }));
  await user.click(await screen.findByRole('button', { name: '메모 마커 늦게까지 여는 세탁소가 있어요.' }));
  const details = within(await screen.findByRole('region', { name: '거리 메모' }));
  expect(details.getByText('👍 좋아요')).toBeInTheDocument();
  expect(details.queryByRole('button', { name: '메모 지우기' })).not.toBeInTheDocument();
  // 메모를 보는 중에 빈 곳을 찍으면 닫기만 한다.
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.queryByRole('region', { name: '거리 메모' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '📝 여기에 메모 남기기' })).not.toBeInTheDocument();
});

it('휴대폰은 빈 곳을 찍으면 아래 시트에서 메모 남기기와 매물 등록을 고른다', async () => {
  const user = userEvent.setup();
  renderMemoMap();
  await user.click(screen.getByRole('button', { name: '화면 범위 알림' }));
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.getByRole('button', { name: '🏠 여기에 매물 등록하기' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '📝 여기에 메모 남기기' }));
  const form = within(await screen.findByRole('region', { name: '메모 남기기' }));
  await user.click(form.getByRole('button', { name: '👎 싫어요' }));
  await user.type(form.getByLabelText('메모'), '골목이 어두워요');
  await user.click(form.getByRole('button', { name: '메모 남기기' }));
  // 메모 탭이 꺼져 있어도 방금 쓴 메모가 보이게 켜고, 쓴 메모를 바로 연다.
  expect(await screen.findByRole('region', { name: '거리 메모' })).toHaveTextContent('골목이 어두워요');
  expect(screen.getByRole('button', { name: /^거리 메모 숨기기/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await screen.findByRole('button', { name: '메모 마커 골목이 어두워요' })).toBeInTheDocument();
});

it('찍은 위치에서 매물 등록을 고르면 그 자리를 가운데로 옮겨 추가 모드를 연다', async () => {
  const user = userEvent.setup();
  renderMemoMap();
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  await user.click(screen.getByRole('button', { name: '🏠 여기에 매물 등록하기' }));
  expect(await screen.findByRole('region', { name: '선택한 위치로 매물 추가' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 중심')).toHaveTextContent(
    JSON.stringify({ latitude: 37.5662, longitude: 126.9785 }),
  );
});
