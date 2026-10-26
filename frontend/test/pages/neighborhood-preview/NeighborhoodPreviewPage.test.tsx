import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

import { commuteBoundaryFixtures } from '@/app/mocks/fixtures/commuteBoundaryFixtures';
import { successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { createCommuteAreaHandlers } from '@/app/mocks/handlers/commuteAreaHandlers';
import NeighborhoodEntryPage from '@/pages/neighborhood-entry/NeighborhoodEntryPage';
import NeighborhoodPreviewPage from '@/pages/neighborhood-preview/NeighborhoodPreviewPage';
import NeighborhoodPricePage from '@/pages/neighborhood-preview/NeighborhoodPricePage';
import NeighborhoodRoutePage from '@/pages/neighborhood-preview/NeighborhoodRoutePage';
import { setAuthentication } from '@/features/auth/model/authStore';
import { MapLocationError, readGeolocationPermission, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

import { server } from '../../server';

vi.mock('@/shared/lib/analytics/posthog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/analytics/posthog')>()),
  trackPostHogEvent: vi.fn(),
}));

vi.mock('@/features/map/lib/mapLocation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/map/lib/mapLocation')>()),
  readGeolocationPermission: vi.fn(),
  requestCurrentMapLocation: vi.fn(),
}));
const mapMounts = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/features/map/ui/map-canvas/MapCanvas', async () => {
  const { useEffect } = await import('react');
  const MockMapCanvas = (props: MapCanvasProps) => {
    useEffect(() => {
      mapMounts.count += 1;
    }, []);
    return (
      <div>
        <button onClick={() => props.onSelectLocation?.(37.4, 127.12)}>지도에서 위치 찍기</button>
        {props.onSelectLocation && (
          <button onClick={() => props.onSelectLocation?.(37.45, 127.15)}>다른 위치 찍기</button>
        )}
        <output aria-label="지도 시점">{JSON.stringify({ center: props.center, level: props.level })}</output>
        <output aria-label="목적지 좌표">{JSON.stringify(props.markers)}</output>
        <output aria-label="지도 스타일">{props.customStyleId}</output>
        {props.coordinateAction && (
          <button onClick={props.coordinateAction.onClick} disabled={props.coordinateAction.disabled}>
            {props.coordinateAction.label}
          </button>
        )}
        {props.regions?.map((region) => (
          <button key={region.id} onClick={() => props.onSelectRegion?.(region.id)}>
            {region.name}
          </button>
        ))}
      </div>
    );
  };
  return { default: MockMapCanvas };
});
beforeEach(() => {
  mapMounts.count = 0;
  vi.mocked(trackPostHogEvent).mockClear();
  vi.mocked(readGeolocationPermission).mockResolvedValue('prompt');
  vi.mocked(requestCurrentMapLocation).mockReset();
  server.use(...createCommuteAreaHandlers({ delayMs: 0 }));
  server.use(
    http.get('*/api/maps/reverse-geocode', () =>
      HttpResponse.json({
        code: 'SUCCESS',
        message: '성공',
        data: { roadAddress: '경기 성남시 분당구 판교역로', jibunAddress: null, latitude: 37.4, longitude: 127.12 },
      }),
    ),
  );
  server.use(
    http.get('*/boundaries/manifest.json', () =>
      HttpResponse.json({ version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' }),
    ),
    http.get('*/boundaries/:filename', () =>
      HttpResponse.json({
        type: 'FeatureCollection',
        features: commuteBoundaryFixtures.map((fixture) => ({
          type: 'Feature',
          properties: {
            code: fixture.sourceCode,
            name: fixture.fullName.split(' ').at(-1),
            fullName: fixture.fullName,
            baseDate: '20250630',
          },
          geometry: fixture.boundary,
        })),
      }),
    ),
  );
});
const show = (mode = 'commute', isPublic = false, path?: string) => {
  const result = render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', commuteDataSource: 'mock' }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={[path ?? (isPublic ? `/explore/${mode}` : `/neighborhoods/map?mode=${mode}`)]}>
          <Routes>
            <Route path="/explore" element={<NeighborhoodEntryPage />} />
            <Route path={`/explore/${mode}`} element={<NeighborhoodPreviewPage />}>
              <Route path="areas/:adminDongCode" element={<NeighborhoodRoutePage />} />
              <Route path="areas/:adminDongCode/details" element={<NeighborhoodRoutePage />} />
              <Route path="prices/:legalDongCode" element={<NeighborhoodPricePage />} />
            </Route>
            <Route path="/login" element={<h1>로그인 후 방 기록</h1>} />
            <Route path="/neighborhoods" element={<NeighborhoodEntryPage />} />
            <Route path="/neighborhoods/map" element={<NeighborhoodPreviewPage />}>
              <Route path="areas/:adminDongCode" element={<NeighborhoodRoutePage />} />
              <Route path="areas/:adminDongCode/details" element={<NeighborhoodRoutePage />} />
              <Route path="prices/:legalDongCode" element={<NeighborhoodPricePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>,
  );
  return result;
};
const choosePoint = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  return user;
};
it.each([false, true])('공개 탐색 여부 %s: 처음 검색은 40분·환승 1회로 요청한다', async (isPublic) => {
  const requests: URL[] = [];
  const track = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/commute-areas') requests.push(url);
  };
  server.events.on('request:start', track);
  try {
    show('commute', isPublic);
    const user = await choosePoint();
    expect(screen.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '환승 1회 이하' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.searchParams.get('maxMinutes')).toBe('40');
    expect(requests[0]?.searchParams.get('maxTransfers')).toBe('1');
    expect(trackPostHogEvent).toHaveBeenCalledWith(
      'neighborhood_search_submitted',
      expect.objectContaining({ max_minutes: 40, max_transfers: 1 }),
    );
  } finally {
    server.events.removeListener('request:start', track);
  }
});
it('기록 화면으로 나갔다 상세 주소로 돌아와도 선택한 동네와 검색 결과를 복원한다', async () => {
  const view = show('commute', true);
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  const card = await screen.findByRole('button', { name: /1위 역삼1동/ });
  await user.click(card);
  expect(await screen.findByRole('button', { name: /역삼1동 · 약 3분/ })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '이 동네에서 본 방 기록하기' }));
  expect(screen.getByRole('heading', { name: '로그인 후 방 기록' })).toBeInTheDocument();
  view.unmount();
  show('commute', true, '/explore/commute/areas/11230640?mode=commute');
  expect(await screen.findByRole('button', { name: /역삼1동 · 약 3분/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '동네를 먼저 선택해주세요' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('선택한 탐색 조건')).toHaveTextContent('통근 40분 이내');
});
it('이전 검색 정보가 없는 상세 주소도 오류 안내 대신 위치 선택 지도로 돌아간다', async () => {
  show('commute', true, '/explore/commute/areas/11230640?mode=commute');
  expect(await screen.findByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '동네를 먼저 선택해주세요' })).not.toBeInTheDocument();
});
it('공개 통근 탐색은 로그인 없이 결과를 보고 기록 CTA로 로그인에 이어진다', async () => {
  show('commute', true);
  expect(screen.getByText('먼저 위치를 골라주세요')).toBeInTheDocument();
  const user = await choosePoint();
  expect(screen.getByText('원하는 조건을 정해주세요')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '통근 40분 이내' }));
  expect(screen.queryByLabelText('동네 탐색 사용 안내')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '적용' }));
  expect(screen.getByText('이제 동네를 찾아볼까요?')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  expect(screen.queryByLabelText('동네 탐색 사용 안내')).not.toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: '이 동네에서 본 방 기록하기' }));
  expect(await screen.findByRole('heading', { name: '로그인 후 방 기록' })).toBeInTheDocument();
  expect(sessionStorage.getItem('jachwi.exploration-journey')).toContain('selectedLocation');
});
it('공개 탐색의 뒤로 가기는 서비스 탭 대신 공개 탐색 선택으로 돌아간다', async () => {
  show('price', true);
  await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(await screen.findByRole('heading', { name: '자취할 동네를 찾아보세요' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /월세 평균가 보기/ })).toHaveAttribute('href', '/explore/price');
});
it('검색창 뒤로가기로 탐색 기준 선택 화면에 돌아간다', async () => {
  show();
  const user = await choosePoint();
  expect(screen.queryByRole('button', { name: '탐색 기준 바꾸기' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(await screen.findByRole('heading', { name: '자취할 동네를 찾아보세요' })).toBeInTheDocument();
});
it('첫 진입은 지도이며 위치 미허용 시 권한 요청·직접 선택 입구·하단 확인 화면이 없다', async () => {
  show();
  await waitFor(() => expect(readGeolocationPermission).toHaveBeenCalled());
  expect(requestCurrentMapLocation).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 스타일')).toHaveTextContent('631c1c09-380e-427f-b7d8-e600956dac10');
  expect(screen.queryByRole('button', { name: '지도에서 직접 선택' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '이 위치로 선택' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '출퇴근 장소' })).not.toHaveFocus();
  expect(screen.queryByRole('spinbutton', { name: '최대 통근 시간' })).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: '어디로 출퇴근·통학하세요?' })).toHaveTextContent('학교·회사');
  expect(screen.queryByRole('button', { name: '현재 위치에서 찾기' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '통근 40분 이내' }));
  expect(screen.getByRole('region', { name: '통근 시간' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '상세 패널 높이 조절' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '통근 시간' })).toHaveAttribute('data-resizable', 'false');
  expect(screen.getByRole('region', { name: '통근 시간' })).not.toHaveAttribute('data-expanded');
  expect(screen.getByRole('listbox', { name: '최대 통근 시간' })).toBeInTheDocument();
  expect(screen.queryByText('통근 시간·환승 조건으로 주변 동네를 찾아봐요.')).not.toBeInTheDocument();
});
it('위치 권한이 허용되어도 마커만 보여주고 안내 버튼을 누르면 선택·확대한다', async () => {
  vi.mocked(readGeolocationPermission).mockResolvedValue('granted');
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show();
  await waitFor(() => expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55'));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('현재 위치');
  expect(screen.queryByRole('button', { name: '선택한 조건으로 찾기' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  expect(await screen.findByRole('button', { name: '선택한 조건으로 찾기' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent('"level":4');
});
it.each([
  ['commute', false],
  ['price', false],
  ['commute', true],
  ['price', true],
] as const)('%s 지도(공개 %s)에서 다른 위치를 찍으면 현재 위치 점을 지운다', async (mode, isPublic) => {
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show(mode, isPublic);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('current-location'));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  const markers = JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]');
  expect(markers).toEqual([
    expect.objectContaining({ id: 'candidate', tone: 'selected', latitude: 37.4, longitude: 127.12 }),
  ]);
  // 현재 위치를 다시 누르면 점도 다시 표시한다.
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('current-location'));
});
it('현재 위치 조회 실패 시 지도에서 직접 찍을 수 있다', async () => {
  vi.mocked(readGeolocationPermission).mockResolvedValue('granted');
  vi.mocked(requestCurrentMapLocation).mockRejectedValue(new Error('timeout'));
  show();
  await waitFor(() => expect(requestCurrentMapLocation).toHaveBeenCalled());
  await choosePoint();
  expect(screen.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
  expect(screen.queryByText('어디로 출퇴근·통학하세요?')).not.toBeInTheDocument();
});
it('현재 위치 버튼 실패를 안내하고 재시도하면 목적지로 선택한다', async () => {
  vi.mocked(requestCurrentMapLocation)
    .mockRejectedValueOnce(new MapLocationError('denied', 'denied'))
    .mockResolvedValueOnce({ latitude: 37.55, longitude: 127.05 });
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('위치 권한을 허용');
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55'));
  expect(screen.getByRole('button', { name: '선택한 조건으로 찾기' })).toBeInTheDocument();
});
it('검색 결과의 현재 위치 버튼은 목적지와 결과를 유지하고 지도만 이동한다', async () => {
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.getByLabelText('지도 스타일')).toHaveTextContent('631c1c09-380e-427f-b7d8-e600956dac10');
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55'));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('current-location');
});
it('지도에서 찍으면 선택 위치로 확대하고 바텀시트에서 필터를 선택한다', async () => {
  show();
  await choosePoint();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent('"level":4');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
});
it.each([false, true])('로그인 여부와 관계없이 주소 검색 결과로 위치를 선택한다 (공개 탐색: %s)', async (isPublic) => {
  server.use(
    http.get('http://localhost:8080/api/maps/geocode', ({ request }) => {
      expect(new URL(request.url).searchParams.get('query')).toBe('신논현역');
      return HttpResponse.json(
        successEnvelope([{ roadAddress: '서울 강남구 봉은사로 102', latitude: 37.5045, longitude: 127.0249 }]),
      );
    }),
  );
  show('commute', isPublic);
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '출퇴근 장소' }), '신논현역');
  await user.keyboard('{Enter}');
  await user.click(await screen.findByRole('button', { name: '서울 강남구 봉은사로 102' }));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.5045');
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent('"level":4');
});
it('통근 필터·조회·동네 선택 및 닫기에도 결과와 시점을 유지한다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '환승 1회 이하' }));
  await user.click(screen.getByRole('radio', { name: '환승 없음' }));
  await user.click(screen.getByRole('button', { name: '적용' }));
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.queryByRole('button', { name: '정자동' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '역삼1동' }));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '상세 패널 높이 조절' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent('"level":7');
  expect(screen.getByRole('button', { name: /대중교통 정보 보기/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '역삼1동' })).toBeInTheDocument();
});
it('상위 동네 카드를 선택하면 첫 정류장의 상세 경로를 받고 다른 정류장도 선택할 수 있다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.getByLabelText('통근 시간 상위 동네').querySelectorAll('button')).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: /1위 역삼1동/ }));
  // 출발 정류장은 지도 마커가 아니라 상세의 선택지로만 보여준다.
  expect(JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]')).toEqual([
    expect.objectContaining({ id: 'destination' }),
  ]);
  expect(trackPostHogEvent).toHaveBeenCalledWith(
    'neighborhood_area_selected',
    expect.objectContaining({ feature: 'commute' }),
  );
  expect(vi.mocked(trackPostHogEvent).mock.calls.filter(([event]) => event === 'commute_route_viewed')).toHaveLength(0);
  const view = screen.getByLabelText('지도 시점').textContent;
  expect(screen.queryByLabelText('대중교통 경로')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /대중교통 정보 보기/ }));
  expect(await screen.findByLabelText('대중교통 경로')).toHaveTextContent('예상 3분');
  await waitFor(() =>
    expect(trackPostHogEvent).toHaveBeenCalledWith(
      'commute_route_viewed',
      expect.objectContaining({ feature: 'commute' }),
    ),
  );
  expect(screen.getByLabelText('대중교통 경로')).toHaveTextContent('도보');
  await user.click(screen.getByRole('button', { name: /역삼역.포스코센터/ }));
  expect(trackPostHogEvent).toHaveBeenCalledWith(
    'commute_departure_station_changed',
    expect.objectContaining({ feature: 'commute' }),
  );
  await waitFor(() => expect(screen.getByLabelText('대중교통 경로')).toHaveTextContent('예상 5분'));
  await user.click(screen.getByRole('button', { name: '대중교통 상세 닫기' }));
  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('지도 시점').textContent).toBe(view);
});
it('가격 기준에서는 통근 필터를 숨긴다', async () => {
  show('price');
  await choosePoint();
  expect(screen.queryByRole('spinbutton', { name: '최대 통근 시간' })).not.toBeInTheDocument();
});
it('월세 평균가 필터를 적용하고 지도 가격을 선택하면 별도 거래 페이지로 이동한다', async () => {
  setAuthentication({ accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600 });
  server.use(
    http.get('*/boundaries/legal-manifest.json', () =>
      HttpResponse.json({
        files: {
          emd: 'legal-emd.123456abcdef.geojson',
          lio: 'legal-lio.123456abcdef.geojson',
          sig: 'legal-sig.123456abcdef.geojson',
        },
      }),
    ),
    http.get('*/boundaries/legal-:kind.:hash.geojson', ({ params }) =>
      HttpResponse.json({
        type: 'FeatureCollection',
        features:
          params.kind === 'emd'
            ? [
                {
                  type: 'Feature',
                  properties: { A1: '41135101', A2: '테스트동', A4: '41135' },
                  geometry: {
                    type: 'Polygon',
                    coordinates: [
                      [
                        [127.11, 37.39],
                        [127.13, 37.39],
                        [127.13, 37.41],
                        [127.11, 37.41],
                        [127.11, 37.39],
                      ],
                    ],
                  },
                },
              ]
            : [],
      }),
    ),
    http.get('*/api/rental-transactions', () =>
      HttpResponse.json({
        code: 'SUCCESS',
        message: '성공',
        data: {
          legalDongCode: '4113510100',
          page: 0,
          hasNext: false,
          totalCount: 1,
          collectedAt: null,
          queryStartDate: '2026-04-01',
          queryEndDate: '2026-10-01',
          items: [
            {
              rentalTransactionId: 1,
              monthlyRentAmountKrw: 500000,
              depositAmountKrw: 10000000,
              contractDate: '2026-09-01',
              areaM2: 24,
            },
          ],
        },
      }),
    ),
  );
  show('price');
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '월세 평균가 전체' }));
  await user.click(screen.getByRole('option', { name: '60만원 이하' }));
  await user.click(screen.getByRole('button', { name: '적용' }));
  expect(screen.getByRole('button', { name: '60만원 이하' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(screen.getByRole('button', { name: '테스트동' }));
  expect(await screen.findByRole('main', { name: '동네 월세 상세' })).toHaveTextContent('50만원');
  expect(screen.getByText('주변 월세 거래 기록')).toBeInTheDocument();
  await waitFor(() =>
    expect(trackPostHogEvent).toHaveBeenCalledWith(
      'rental_information_viewed',
      expect.objectContaining({ has_transactions: true, transaction_count: 1 }),
    ),
  );
  await user.click(screen.getByRole('button', { name: '월세 상세 닫기' }));
  expect(await screen.findByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
});
it('지도 첫 진입에는 탐색 기준을 선택하고 상단 탭은 표시하지 않는다', async () => {
  render(
    <MemoryRouter>
      <NeighborhoodEntryPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: '자취할 동네를 찾아보세요' })).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /월세 평균가 보기/ })).toHaveAttribute(
    'href',
    '/neighborhoods/map?mode=price',
  );
});
it('통근 서버 오류는 가짜 결과로 대체하지 않는다', async () => {
  server.use(...createCommuteAreaHandlers({ scenario: 'network-unavailable', delayMs: 0 }));
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('대중교통 정보를 준비하고 있습니다.');
  expect(screen.queryByRole('region', { name: '행정동 프리셋 지도' })).not.toBeInTheDocument();
  await waitFor(() =>
    expect(trackPostHogEvent).toHaveBeenCalledWith(
      'neighborhood_search_failed',
      expect.objectContaining({ feature: 'commute' }),
    ),
  );
  expect(
    vi.mocked(trackPostHogEvent).mock.calls.filter(([event]) => event === 'neighborhood_search_results_viewed'),
  ).toHaveLength(0);
});
it('환승은 두 회까지, 통근은 10~60분을 10분 단위로만 선택한다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '통근 40분 이내' }));
  expect(screen.getAllByRole('option')).toHaveLength(6);
  expect(screen.getByRole('option', { name: '10분 이내' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '70분 이내' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: '30분 이내' }));
  expect(screen.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: '통근 40분 이내' }));
  expect(screen.getByRole('option', { name: '40분 이내' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('option', { name: '30분 이내' }));
  await user.click(screen.getByRole('button', { name: '적용' }));
  expect(screen.getByRole('button', { name: '통근 30분 이내' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '선택한 조건으로 찾기' })).toBeEnabled();
});
it('경계는 조회 버튼 이후에만 원본을 받고 다시 조회하면 캐시를 재사용한다', async () => {
  const paths: string[] = [];
  const track = ({ request }: { request: Request }) => paths.push(new URL(request.url).pathname);
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    expect(paths.filter((path) => path.includes('/boundaries/'))).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(paths.filter((path) => path.endsWith('.geojson'))).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(paths.filter((path) => path.endsWith('.geojson'))).toHaveLength(1);
    expect(paths.filter((path) => path.endsWith('/manifest.json'))).toHaveLength(2);
  } finally {
    server.events.removeListener('request:start', track);
  }
});
it('분할 manifest에서는 결과에 나온 시도 파일만 받아 합치고 재조회 시 각 파일의 캐시를 재사용한다', async () => {
  const files = {
    '11': 'admin-dongs.11.20250630.111111111111.geojson',
    '23': 'admin-dongs.23.20250630.333333333333.geojson',
    '31': 'admin-dongs.31.20250630.222222222222.geojson',
  };
  const requested: string[] = [];
  server.use(
    http.get('*/boundaries/manifest.json', () =>
      HttpResponse.json({ version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson', files }),
    ),
    http.get('*/boundaries/:filename', ({ params }) => {
      const filename = String(params.filename);
      requested.push(filename);
      const prefix = filename.split('.')[1];
      return HttpResponse.json({
        type: 'FeatureCollection',
        features: commuteBoundaryFixtures
          .filter((fixture) => fixture.sourceCode.startsWith(prefix))
          .map((fixture) => ({
            type: 'Feature',
            properties: {
              code: fixture.sourceCode,
              name: fixture.fullName.split(' ').at(-1),
              fullName: fixture.fullName,
              baseDate: '20250630',
            },
            geometry: fixture.boundary,
          })),
      });
    }),
  );
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(requested.sort()).toEqual([files['11'], files['31']]);
  expect(screen.getByRole('button', { name: '역삼1동' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '정자동' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(requested).toHaveLength(2);
});

it('manifest의 해시가 바뀌면 이전 경계 캐시 대신 새 파일을 받는다', async () => {
  let file = 'admin-dongs.20250630.123456abcdef.geojson';
  server.use(http.get('*/boundaries/manifest.json', () => HttpResponse.json({ version: '20250630', file })));
  const files: string[] = [];
  const track = ({ request }: { request: Request }) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith('.geojson')) files.push(path);
  };
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    file = 'admin-dongs.20250630.abcdef123456.geojson';
    await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(files).toEqual([
      '/boundaries/admin-dongs.20250630.123456abcdef.geojson',
      '/boundaries/admin-dongs.20250630.abcdef123456.geojson',
    ]);
  } finally {
    server.events.removeListener('request:start', track);
  }
});
it('결과 지도 클릭은 목적지·결과를 유지하고 다시 선택하기를 눌러야 새 위치를 고른다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '다른 위치 찍기' }));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.45');
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.queryByText('거래 평균가')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '역삼1동' }));
  await user.keyboard('{Escape}');
  const markers = screen.getByLabelText('목적지 좌표').textContent;
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표').textContent).toBe(markers);
  await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.queryByRole('region', { name: '행정동 프리셋 지도' })).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: '선택한 동네 정보' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.getByRole('button', { name: '선택한 조건으로 찾기' })).toBeEnabled();
});

it('위치 선택·분석·결과·다시 선택하기 내내 지도를 새로 만들지 않는다', async () => {
  server.use(...createCommuteAreaHandlers({ delayMs: 50 }));
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  expect(await screen.findByRole('heading', { name: '주변 동네를 분석하고 있어요' })).toBeInTheDocument();
  // 분석 화면이 덮고 있는 동안에도 지도는 남아 있고, 찾기 버튼은 꺼진다.
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '선택한 조건으로 찾기' })).not.toBeInTheDocument();
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
  expect(await screen.findByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(mapMounts.count).toBe(1);
});
it.each([false, true])(
  '공개 탐색 여부 %s: 결과 지도에는 외부 링크를 두지 않고 동네 상세에서 다방과 주변 분석을 연다',
  async (isPublic) => {
    show('commute', isPublic);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await user.click(await screen.findByRole('button', { name: /2위 신림동/ }));
    expect(await screen.findByRole('button', { name: /신림동 · 약 27분/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /다방에서/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /주변 시설 분석/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /신림동 · 약 27분/ }));
    expect(await screen.findByRole('main', { name: '신림동 대중교통 상세' })).toBeInTheDocument();
    const dabangLink = screen.getByRole('link', { name: /다방에서 신림동 원·투룸 보기/ });
    expect(dabangLink).toHaveAttribute('target', '_blank');
    expect(dabangLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(dabangLink.getAttribute('href')).toMatch(
      /^https:\/\/www\.dabangapp\.com\/(mobile\/)?map\/onetwo\?m_lat=37\.\d+&m_lng=126\.\d+&m_zoom=15$/,
    );
    dabangLink.addEventListener('click', (event) => event.preventDefault());
    await user.click(dabangLink);
    expect(trackPostHogEvent).toHaveBeenCalledWith(
      'neighborhood_listing_link_clicked',
      expect.objectContaining({ provider: 'dabang', feature: 'commute' }),
    );
    expect(screen.queryByRole('button', { name: '이 동네에서 본 방 기록하기' }) !== null).toBe(isPublic);
    const nearbyUrl = new URL(
      screen.getByRole('link', { name: /신림동 주변 시설 분석/ }).getAttribute('href') ?? '',
      'http://localhost',
    );
    expect(nearbyUrl.pathname).toBe(isPublic ? '/explore/nearby' : '/neighborhoods/nearby');
    expect(nearbyUrl.searchParams.get('name')).toBe('신림동');
    expect(Number(nearbyUrl.searchParams.get('latitude'))).toBeCloseTo(37.48, 1);
    expect(nearbyUrl.searchParams.get('backTo')).toMatch(/\/areas\/11210690\/details/);
  },
);
