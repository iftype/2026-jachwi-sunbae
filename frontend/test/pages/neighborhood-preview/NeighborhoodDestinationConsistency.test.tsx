import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { propertyPageFixture, successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { createCommuteAreaHandlers } from '@/app/mocks/handlers/commuteAreaHandlers';
import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { RecordsMapProvider } from '@/pages/design-records/RecordsMapProvider';
import NeighborhoodPreviewPage from '@/pages/neighborhood-preview/NeighborhoodPreviewPage';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

/** 지도에 넘어간 마지막 props. 지도 중심, 핀, 분석에 실린 좌표가 모두 같은 목적지에서 나오는지 숫자로 본다. */
const lastMap = vi.hoisted(() => ({ props: null as MapCanvasProps | null }));
vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: (props: MapCanvasProps) => {
    lastMap.props = props;
    return <div />;
  },
}));
vi.mock('@/shared/lib/analytics/posthog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/analytics/posthog')>()),
  trackPostHogEvent: vi.fn(),
}));

const POINTS: Record<string, { name: string; latitude: number; longitude: number }> = {
  동대문: { name: '서울 동대문구 왕산로 214', latitude: 37.5744, longitude: 127.0396 },
  판교역: { name: '경기 성남시 분당구 판교역로 160', latitude: 37.3948, longitude: 127.1112 },
};
const analysisRequests: { latitude: number; longitude: number }[] = [];

const recordAnalysis = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  if (url.pathname === '/api/commute-areas/with-rents')
    analysisRequests.push({
      latitude: Number(url.searchParams.get('latitude')),
      longitude: Number(url.searchParams.get('longitude')),
    });
};
afterEach(() => server.events.removeListener('request:start', recordAnalysis));
beforeEach(() => {
  analysisRequests.length = 0;
  server.use(...createCommuteAreaHandlers({ delayMs: 0 }), ...mapHandlers);
  server.use(
    http.get('*/api/maps/search', ({ request }) => {
      const query = new URL(request.url).searchParams.get('query') ?? '';
      const point = POINTS[query] ?? POINTS['동대문']!;
      return HttpResponse.json(
        successEnvelope([{ roadAddress: point.name, jibunAddress: null, address: null, ...point }]),
      );
    }),
    http.get('*/api/admin-dong-bookmarks', () => HttpResponse.json(successEnvelope({ codes: [] }))),
    // 같은 검색어라도 주소 지오코딩(/api/maps/geocode)은 장소 검색(/api/maps/search)과 다른 좌표를 돌려줄 수 있다.
    http.get('*/api/maps/geocode', ({ request }) => {
      const query = new URL(request.url).searchParams.get('query') ?? '';
      const point = POINTS[query] ?? POINTS['동대문']!;
      return HttpResponse.json(
        successEnvelope([
          {
            roadAddress: point.name,
            jibunAddress: null,
            address: null,
            latitude: point.latitude + 0.01,
            longitude: point.longitude + 0.01,
          },
        ]),
      );
    }),
    http.get('*/api/maps/reverse-geocode', () =>
      HttpResponse.json(
        successEnvelope({ roadAddress: '지도에서 누른 곳 주소', jibunAddress: null, latitude: 37.5, longitude: 127 }),
      ),
    ),
    http.get('*/api/properties/commute-times', () =>
      HttpResponse.json(successEnvelope({ maxMinutes: 60, maxTransfers: 2, properties: [] })),
    ),
    http.get('*/api/properties', () => HttpResponse.json(successEnvelope(propertyPageFixture([])))),
    http.get('*/boundaries/manifest.json', () => HttpResponse.json({ version: '1', file: 'a.geojson' })),
    http.get('*/boundaries/:filename', () => HttpResponse.json({ type: 'FeatureCollection', features: [] })),
  );
  server.events.on('request:start', recordAnalysis);
});

const show = () =>
  render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', commuteDataSource: 'mock' }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={['/explore']}>
          <Routes>
            <Route path="/explore/*" element={<NeighborhoodPreviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>,
  );

const pin = () => lastMap.props?.markers?.find((marker) => marker.id === 'destination');
const center = () => lastMap.props?.center;
const round = (value: number | undefined) => value?.toFixed(4);

const searchAndPick = async (user: ReturnType<typeof userEvent.setup>, query: string) => {
  const box = screen.getByRole('textbox', { name: '출퇴근 장소' });
  await user.clear(box);
  await user.type(box, query);
  await user.keyboard('{Enter}');
  await user.click(await screen.findByRole('button', { name: new RegExp(POINTS[query]!.name) }));
};

const expectSameDestination = (expected: { latitude: number; longitude: number }) => {
  expect(round(center()?.latitude)).toBe(round(expected.latitude));
  expect(round(center()?.longitude)).toBe(round(expected.longitude));
  expect(round(pin()?.latitude)).toBe(round(expected.latitude));
  expect(round(pin()?.longitude)).toBe(round(expected.longitude));
};

it('검색으로 고른 목적지는 지도 중심, 핀, 통근 분석 요청이 모두 같은 좌표다', async () => {
  const user = userEvent.setup();
  show();
  // 처음에는 지도를 눌러 고르는 모드를 켠다.
  const toggle = screen.queryByRole('button', { name: '지도에서 목적지 선택' });
  if (toggle) await user.click(toggle);

  // ① 동대문을 검색해 첫 결과를 고른다.
  await searchAndPick(user, '동대문');
  expectSameDestination(POINTS['동대문']!);
  await user.click(screen.getByRole('button', { name: /이 조건으로 동네 찾기|에서 찾기/ }));
  await waitFor(() => expect(analysisRequests.length).toBeGreaterThan(0));
  // ② 분석 요청에 실린 목적지.
  expect(analysisRequests.at(-1)).toEqual({ latitude: 37.5744, longitude: 127.0396 });
  // 결과 지도의 목적지 마커도 같은 값이다.
  await waitFor(() => expect(round(pin()?.latitude)).toBe('37.5744'));

  // ④ 이어서 판교역을 검색해 고른다. 결과 화면에서 새로 고르면 이전 결과의 통근 색이 남아 있으면 안 된다.
  const searchBox = screen.queryByRole('textbox', { name: '출퇴근 장소' });
  if (searchBox) {
    await searchAndPick(user, '판교역');
    expect(round(pin()?.latitude)).toBe('37.3948');
    expect(round(pin()?.longitude)).toBe('127.1112');
    // 새 목적지를 찾기 전에는 이전(동대문 기준) 통근 구역을 지도에 칠하지 않는다.
    expect(lastMap.props?.regions ?? []).toHaveLength(0);
  }
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

const renderMember = () =>
  render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', commuteDataSource: 'mock' }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={['/neighborhoods']}>
          <Routes>
            <Route
              path="/neighborhoods/*"
              element={
                <RecordsMapProvider>
                  <NeighborhoodPreviewPage />
                </RecordsMapProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>,
  );
const searchPin = () => lastMap.props?.markers?.find((marker) => marker.id === 'search-pin');

it('지도 검색은 출퇴근 장소를 바꾸지 않고, 검색 핀의 설정 버튼이 값을 복사하며, 분석 좌표는 항상 출퇴근 장소다', async () => {
  const matchMedia = useDesktopViewport();
  try {
    const user = userEvent.setup();
    renderMember();
    await waitFor(() => expect(lastMap.props?.onSelectLocation).toBeDefined());

    // (나) 출퇴근 장소: `지도에서 선택`을 켜고 지도를 눌러 고른다.
    await user.click(await screen.findByRole('button', { name: '지도에서 선택' }));
    act(() => lastMap.props?.onSelectLocation?.(37.5001, 127.0002));
    await waitFor(() => expect(round(pin()?.latitude)).toBe('37.5001'));
    expect(pin()).toMatchObject({ pinKind: 'commute', longitude: 127.0002 });

    // (가) 지도 검색: `동대문`을 고르면 지도가 가고 검색 핀이 찍히지만, 출퇴근 장소와 분석은 그대로다.
    const mapSearch = await screen.findByRole('textbox', { name: '주소 검색' });
    await user.type(mapSearch, '동대문');
    await user.click(await screen.findByRole('button', { name: /서울 동대문구 왕산로 214/ }));
    await waitFor(() => expect(searchPin()).toBeDefined());
    // 지도 검색은 주소 지오코딩 좌표(POI 좌표 + 0.01)를 쓰고, 지도 중심과 핀이 같다.
    expect(round(searchPin()?.latitude)).toBe('37.5844');
    expect(round(center()?.latitude)).toBe('37.5844');
    expect(round(center()?.longitude)).toBe('127.0496');
    expect(searchPin()).toMatchObject({ pinKind: 'search', setsCommute: true });
    expect(pin()).toMatchObject({ pinKind: 'commute', latitude: 37.5001, longitude: 127.0002 });
    expect(analysisRequests).toHaveLength(0);

    // 검색 핀의 `출퇴근 장소로 설정`: 이때만 지도 검색의 값이 출퇴근 장소로 복사된다.
    act(() => lastMap.props?.onSelectMarker?.({ ...searchPin()!, id: 'search-pin:set-commute' }));
    await waitFor(() => expect(round(pin()?.latitude)).toBe('37.5844'));
    expect(round(pin()?.longitude)).toBe('127.0496');
    expect(analysisRequests).toHaveLength(0);

    // 분석 요청의 목적지는 출퇴근 장소(commute 마커)와 같다.
    await user.click(await screen.findByRole('button', { name: '이 조건으로 동네 찾기' }));
    await waitFor(() => expect(analysisRequests).toHaveLength(1));
    expect(analysisRequests[0]?.latitude).toBeCloseTo(37.5844, 6);
    expect(analysisRequests[0]?.longitude).toBeCloseTo(127.0496, 6);
  } finally {
    matchMedia.mockRestore();
  }
});

it('출퇴근 장소 입력 칸의 검색은 지도 검색 핀을 만들지 않고, 고른 좌표가 분석 좌표가 된다', async () => {
  const matchMedia = useDesktopViewport();
  try {
    const user = userEvent.setup();
    renderMember();
    const field = await screen.findByRole('textbox', { name: '출퇴근 장소' });
    await user.type(field, '판교역');
    await user.click(await screen.findByRole('button', { name: /경기 성남시 분당구 판교역로 160/ }));
    // 출퇴근 장소 검색은 장소 검색(/api/maps/search) 좌표를 쓴다.
    await waitFor(() => expect(round(pin()?.latitude)).toBe('37.3948'));
    expect(round(pin()?.longitude)).toBe('127.1112');
    expect(pin()).toMatchObject({ pinKind: 'commute' });
    expect(searchPin()).toBeUndefined();
    await user.click(await screen.findByRole('button', { name: '이 조건으로 동네 찾기' }));
    await waitFor(() => expect(analysisRequests).toHaveLength(1));
    expect(analysisRequests[0]).toEqual({ latitude: 37.3948, longitude: 127.1112 });
  } finally {
    matchMedia.mockRestore();
  }
});
