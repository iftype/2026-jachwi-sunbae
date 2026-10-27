import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

import { commuteBoundaryFixtures } from '@/app/mocks/fixtures/commuteBoundaryFixtures';
import { successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { createCommuteAreaHandlers } from '@/app/mocks/handlers/commuteAreaHandlers';
import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import NeighborhoodPreviewPage from '@/pages/neighborhood-preview/NeighborhoodPreviewPage';
import NeighborhoodRoutePage from '@/pages/neighborhood-preview/NeighborhoodRoutePage';
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
        {props.onBoundsChange && (
          <button
            onClick={() => {
              props.onLevelChange?.(4);
              props.onBoundsChange?.({ south: 37.495, west: 127.03, north: 37.506, east: 127.044 });
            }}
          >
            가까이 확대
          </button>
        )}
        {props.onBoundsChange && (
          <button
            onClick={() => {
              props.onLevelChange?.(7);
              props.onBoundsChange?.({ south: 37.49, west: 127.02, north: 37.51, east: 127.04 });
            }}
          >
            화면 범위 알림
          </button>
        )}
        {props.markers
          ?.filter((marker) => marker.actionable)
          .map((marker) => (
            <button key={marker.id} onClick={() => props.onSelectMarker?.(marker)}>
              {`마커 ${marker.label}`}
            </button>
          ))}
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
const show = (isPublic = false, entries?: string[]) => {
  const result = render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', commuteDataSource: 'mock' }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter
          initialEntries={entries ?? [isPublic ? '/explore' : '/neighborhoods']}
          initialIndex={entries ? entries.length - 1 : 0}
        >
          <Routes>
            <Route path="/" element={<h1>홈</h1>} />
            <Route path="/guide" element={<h1>사용 방법</h1>} />
            <Route path="/explore" element={<NeighborhoodPreviewPage />}>
              <Route path="areas/:adminDongCode" element={<NeighborhoodRoutePage />} />
              <Route path="areas/:adminDongCode/details" element={<NeighborhoodRoutePage />} />
            </Route>
            <Route path="/login" element={<h1>로그인 후 방 기록</h1>} />
            <Route path="/neighborhoods" element={<NeighborhoodPreviewPage />}>
              <Route path="areas/:adminDongCode" element={<NeighborhoodRoutePage />} />
              <Route path="areas/:adminDongCode/details" element={<NeighborhoodRoutePage />} />
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
    if (url.pathname === '/api/commute-areas/with-rents') requests.push(url);
  };
  server.events.on('request:start', track);
  try {
    show(isPublic);
    const user = await choosePoint();
    expect(screen.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '환승 1회 이하' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
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
  const view = show(true);
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  const card = await screen.findByRole('button', { name: /1위 역삼1동/ });
  await user.click(card);
  expect(await screen.findByRole('button', { name: /역삼1동 · 약 3분/ })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '이 동네에서 본 방 기록하기' }));
  expect(screen.getByRole('heading', { name: '로그인 후 방 기록' })).toBeInTheDocument();
  view.unmount();
  show(true, ['/explore/areas/11230640']);
  expect(await screen.findByRole('button', { name: /역삼1동 · 약 3분/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '동네를 먼저 선택해주세요' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('선택한 탐색 조건')).toHaveTextContent('통근 40분 이내');
});
it('이전 검색 정보가 없는 상세 주소도 오류 안내 대신 위치 선택 지도로 돌아간다', async () => {
  show(true, ['/explore/areas/11230640']);
  expect(await screen.findByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '동네를 먼저 선택해주세요' })).not.toBeInTheDocument();
});
it('공개 통근 탐색은 로그인 없이 결과를 보고 기록 CTA로 로그인에 이어진다', async () => {
  show(true);
  expect(screen.getByRole('note')).toHaveTextContent('지도를 눌러 출퇴근 장소를 찍어보세요');
  const user = await choosePoint();
  // 위치를 고른 뒤에는 단계별 안내 없이 바로 조건을 바꾸거나 찾을 수 있다.
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
  expect(screen.queryByText('원하는 조건을 정해주세요')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '통근 40분 이내' }));
  await user.click(screen.getByRole('button', { name: '적용' }));
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  await user.click(await screen.findByRole('button', { name: '이 동네에서 본 방 기록하기' }));
  expect(await screen.findByRole('heading', { name: '로그인 후 방 기록' })).toBeInTheDocument();
  expect(sessionStorage.getItem('jachwi.exploration-journey')).toContain('selectedLocation');
});
it('탐색 기준 선택 화면 없이 바로 지도에서 통근·환승·월세 조건을 함께 고른다', async () => {
  show(true);
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /월세 평균가 보기/ })).not.toBeInTheDocument();
  const conditions = screen.getByLabelText('탐색 조건');
  expect(conditions).toHaveTextContent('통근 40분 이내');
  expect(conditions).toHaveTextContent('환승 1회 이하');
  expect(conditions).toHaveTextContent('월세 전체');
});
it('검색창 뒤로가기는 들어온 화면으로 돌아가고, 주소로 바로 들어왔으면 홈으로 간다', async () => {
  const view = show(false, ['/guide', '/neighborhoods']);
  await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(await screen.findByRole('heading', { name: '사용 방법' })).toBeInTheDocument();
  view.unmount();
  show(true);
  await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument();
});
it('월세 조건은 받은 동네 시세를 거르고, 결과에서 바꿔도 다시 조회하지 않는다', async () => {
  const requests: URL[] = [];
  const track = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/commute-areas/with-rents') requests.push(url);
  };
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '월세 전체' }));
    await user.click(screen.getByRole('option', { name: '50만원 이하' }));
    await user.click(screen.getByRole('button', { name: '적용' }));
    await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
    const rail = await screen.findByLabelText('통근 시간 상위 동네');
    // 역삼1동은 시세가 68만원이고, 정자동은 거래가 적어 시세가 없다.
    expect(rail.querySelectorAll('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /1위 신림동/ })).toHaveTextContent('월세 45만원');
    expect(screen.queryByRole('button', { name: '역삼1동' })).not.toBeInTheDocument();
    expect(trackPostHogEvent).toHaveBeenCalledWith(
      'neighborhood_search_submitted',
      expect.objectContaining({ max_rent_manwon: 50 }),
    );
    await user.click(screen.getByRole('button', { name: /월세 50만원 이하/ }));
    await user.click(screen.getByRole('option', { name: '전체 가격' }));
    await user.click(screen.getByRole('button', { name: '적용' }));
    expect(screen.getByLabelText('통근 시간 상위 동네').querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /3위 정자동/ })).toHaveTextContent('시세 없음');
    expect(requests).toHaveLength(1);
  } finally {
    server.events.removeListener('request:start', track);
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
it('데스크탑은 왼쪽 칸에서 조건을 고르고 바로 찾는다', async () => {
  const requests: URL[] = [];
  const track = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/commute-areas/with-rents') requests.push(url);
  };
  server.events.on('request:start', track);
  const matchMedia = useDesktopViewport();
  try {
    show();
    const panel = within(screen.getByRole('complementary', { name: '탐색 조건' }));
    expect(screen.queryByRole('button', { name: '통근 40분 이내' })).not.toBeInTheDocument();
    expect(panel.getByRole('button', { name: '이 조건으로 동네 찾기' })).toBeDisabled();
    const user = await choosePoint();
    await user.click(panel.getByRole('radio', { name: '30분' }));
    await user.click(panel.getByRole('radio', { name: '환승 없음' }));
    await user.selectOptions(panel.getByRole('combobox', { name: '최대 월세 시세' }), '50만원 이하');
    await user.click(panel.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    const areas = within(await screen.findByRole('complementary', { name: '통근 시간 상위 동네' }));
    expect(areas.getAllByRole('button', { name: /위 / })).toHaveLength(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get('maxMinutes')).toBe('30');
    expect(requests[0].searchParams.get('maxTransfers')).toBe('0');
  } finally {
    matchMedia.mockRestore();
    server.events.removeListener('request:start', track);
  }
});
it('데스크탑 결과는 상위 동네를 지도 왼쪽 칸에 세로로 보여준다', async () => {
  const matchMedia = useDesktopViewport();
  try {
    show();
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    const panel = within(await screen.findByRole('complementary', { name: '통근 시간 상위 동네' }));
    expect(panel.getByRole('heading', { name: '통근 시간 상위 동네' })).toBeInTheDocument();
    expect(panel.getAllByRole('button', { name: /위 / })).toHaveLength(3);
    // 기준 요약과 다시 선택하기도 지도 위가 아니라 왼쪽 칸에 둔다. 지도에는 색상 기준만 남긴다.
    expect(panel.getByLabelText('선택한 탐색 조건')).toHaveTextContent('통근 40분 이내');
    expect(panel.getByRole('button', { name: '다시 선택하기' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '다시 선택하기' })).toHaveLength(1);
    expect(screen.getByLabelText('통근 시간 색상 기준')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /1위 역삼1동/ })).toHaveTextContent('월세 68만원');
    await userEvent.selectOptions(panel.getByRole('combobox', { name: '최대 월세 시세' }), '월세 50만원 이하');
    expect(panel.getAllByRole('button', { name: /위 / })).toHaveLength(1);
  } finally {
    matchMedia.mockRestore();
  }
});
it('월세 조건에 맞는 동네가 없으면 조건을 넓혀보라고 안내한다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '월세 전체' }));
  await user.click(screen.getByRole('option', { name: '10만원 이하' }));
  await user.click(screen.getByRole('button', { name: '적용' }));
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  expect(await screen.findByText('조건에 맞는 동네가 없어요. 월세 조건을 넓혀보세요.')).toBeInTheDocument();
});
it('동네 상세에서 통근 경로와 함께 월세·보증금 시세와 거래 기간을 보여준다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  await user.click(await screen.findByRole('button', { name: /2위 신림동/ }));
  await user.click(await screen.findByRole('button', { name: /신림동 · 약 27분 · 월세 45만원/ }));
  const rent = await screen.findByRole('region', { name: '월세 시세' });
  expect(rent).toHaveTextContent('월세 45만원 · 보증금 500만원');
  expect(rent).toHaveTextContent('신림동·봉천동 거래 18건 중앙값');
  expect(rent).toHaveTextContent('2026-03-31 ~ 2026-09-30 계약');
  await user.click(screen.getByRole('button', { name: '대중교통 상세 닫기' }));
  await user.click(await screen.findByRole('button', { name: '정자동' }));
  await user.click(await screen.findByRole('button', { name: /정자동 · 약 38분\n/ }));
  expect(await screen.findByRole('region', { name: '월세 시세' })).toHaveTextContent(
    '거래가 적어 시세를 내지 않았어요',
  );
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
  expect(screen.getByRole('note')).toHaveTextContent('위 검색창에서 학교·회사를 찾아도 돼요');
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
  expect(screen.queryByRole('button', { name: /에서 찾기$/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  expect(await screen.findByRole('button', { name: /에서 찾기$/ })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent('"level":4');
});
it.each([false, true])('지도(공개 %s)에서 다른 위치를 찍으면 현재 위치 점을 지운다', async (isPublic) => {
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show(isPublic);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('current-location'));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  const markers = JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]');
  expect(markers).toEqual([
    expect.objectContaining({ id: 'candidate', tone: 'destination', latitude: 37.4, longitude: 127.12 }),
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
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
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
  expect(screen.getByRole('button', { name: /에서 찾기$/ })).toBeInTheDocument();
});
it('검색 결과의 현재 위치 버튼은 목적지와 결과를 유지하고 지도만 이동한다', async () => {
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.getByLabelText('지도 스타일')).toHaveTextContent('631c1c09-380e-427f-b7d8-e600956dac10');
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55'));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('current-location');
});
it('지도에서 찍으면 시점을 옮기지 않아 누른 자리에 핀이 찍히고 바텀시트에서 필터를 선택한다', async () => {
  show();
  const before = screen.getByLabelText('지도 시점').textContent;
  await choosePoint();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent(before ?? '');
  // 찾기 버튼은 지도 위가 아니라 아래에 올리고, 버튼 글자에 고른 장소 이름을 넣는다.
  const card = within(screen.getByRole('region', { name: '고른 출퇴근 장소' }));
  expect(card.getByRole('button', { name: /에서 찾기$/ })).toBeEnabled();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
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
  show(isPublic);
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
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
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
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
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
  // 상세에는 출발 정류장 선택지를 두지 않는다.
  expect(screen.queryByLabelText('출발 정류장 선택')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '대중교통 상세 닫기' }));
  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('지도 시점').textContent).toBe(view);
});
it('데스크탑은 동네를 고르면 왼쪽 목록에 시세·출발 정류장을 펼치고, 정류장을 고르면 가운데 칸에 경로를 연다', async () => {
  const matchMedia = useDesktopViewport();
  try {
    show();
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await user.click(await screen.findByRole('button', { name: /1위 역삼1동/ }));
    // 동네를 고르는 것만으로는 경로를 그리지 않는다. 지도 위 '대중교통 정보 보기' 말풍선도 두지 않는다.
    const summary = within(screen.getByRole('region', { name: '역삼1동 요약' }));
    expect(summary.getByText('월세 68만원 / 보증금 1,000만원')).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: '역삼1동 대중교통 상세' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('대중교통 경로')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /대중교통 정보 보기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
    await user.click(summary.getByRole('button', { name: /^역삼역\s?3분$/ }));
    const panel = within(await screen.findByRole('region', { name: '역삼역 정보' }));
    expect(await panel.findByLabelText('대중교통 경로')).toHaveTextContent('예상 3분');
    expect(summary.getByRole('button', { name: /^역삼역\s?3분$/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(summary.getByRole('button', { name: /^역삼역\.포스코센터/ }));
    expect(trackPostHogEvent).toHaveBeenCalledWith(
      'commute_departure_station_changed',
      expect.objectContaining({ feature: 'commute' }),
    );
    expect(await screen.findByRole('region', { name: /역삼역\.포스코센터 .*정보/ })).toBeInTheDocument();
    // 다른 동네를 고르면 열어 둔 정류장 경로는 닫고 그 동네 요약을 펼친다.
    await user.click(screen.getByRole('button', { name: /2위 신림동/ }));
    expect(screen.queryByRole('region', { name: '역삼역 정보' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '신림동 요약' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '역삼1동 요약' })).not.toBeInTheDocument();
    // 다시 선택하기는 열어 둔 정류장 경로도 닫는다.
    await user.click(
      within(screen.getByRole('region', { name: '신림동 요약' })).getByRole('button', { name: /^신림역/ }),
    );
    expect(await screen.findByRole('region', { name: /신림역.*정보/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
    expect(screen.queryByRole('region', { name: /신림역.*정보/ })).not.toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});
it('결과 지도를 가까이 확대하면 화면 안 정류장·부동산을 올리고 눌러 정보를 본다', async () => {
  server.use(...mapHandlers);
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  expect(await screen.findByText('동네를 고르거나 가까이 확대하면 정류장·부동산이 보여요')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^마커 / })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '가까이 확대' }));
  await waitFor(() =>
    expect(JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'AGENCY', tone: 'place' }),
        expect.objectContaining({ category: 'TRANSPORT', tone: 'place' }),
      ]),
    ),
  );
  await user.click(screen.getByRole('button', { name: '마커 역삼역 공인중개사' }));
  const card = within(screen.getByRole('region', { name: '역삼역 공인중개사 정보' }));
  // 휴대폰은 바텀시트로 띄우고, 낮은 상태에서 바로 전화를 걸 수 있다.
  expect(card.getByText(/^공인중개사/)).toBeInTheDocument();
  expect(card.getByRole('link', { name: /전화 걸기/ })).toHaveAttribute('href', 'tel:02-555-1201');
  await user.click(card.getByRole('button', { name: '정보 닫기' }));
  expect(screen.queryByRole('region', { name: '역삼역 공인중개사 정보' })).not.toBeInTheDocument();
  // 정류장·부동산 정보를 띄우는 동안은 동네 위 말풍선을 숨긴다.
  await user.click(await screen.findByRole('button', { name: /1위 역삼1동/ }));
  expect(screen.getByRole('button', { name: /대중교통 정보 보기/ })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '마커 역삼역' }));
  expect(screen.queryByRole('button', { name: /대중교통 정보 보기/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '정보 닫기' }));
  expect(screen.getByRole('button', { name: /대중교통 정보 보기/ })).toBeInTheDocument();
  // 정류장은 시트에 예상 시간만 요약하고, 자세한 경로는 전체 화면으로 연다.
  await user.click(screen.getByRole('button', { name: '마커 역삼역' }));
  const stop = within(screen.getByRole('region', { name: '역삼역 정보' }));
  expect(await stop.findByText(/^예상 \d+분 · 환승 \d회$/)).toBeInTheDocument();
  expect(stop.queryByLabelText('대중교통 경로')).not.toBeInTheDocument();
  await user.click(stop.getByRole('button', { name: '경로 자세히 보기' }));
  const route = within(screen.getByRole('region', { name: '역삼역 출발 경로' }));
  expect(route.getByLabelText('대중교통 경로')).toHaveTextContent('예상');
  await user.click(route.getByRole('button', { name: '경로 닫기' }));
  expect(screen.getByRole('region', { name: '역삼역 정보' })).toBeInTheDocument();
});
it('동네를 고르면 확대하지 않아도 옮겨 간 화면의 정류장·부동산을 올린다', async () => {
  server.use(...mapHandlers);
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  await user.click(await screen.findByRole('button', { name: /1위 역삼1동/ }));
  // 지도가 동네로 옮겨 간 뒤 이동이 끝나면(idle) 그 화면 범위를 알린다. 확대 단계는 동네 보기(7) 그대로다.
  await user.click(screen.getByRole('button', { name: '화면 범위 알림' }));
  await waitFor(() =>
    expect(JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'AGENCY' }),
        expect.objectContaining({ category: 'TRANSPORT' }),
      ]),
    ),
  );
  expect(screen.getByText('정류장·부동산을 눌러 정보를 볼 수 있어요')).toBeInTheDocument();
});
it('데스크탑은 지도에서 고른 부동산·정류장 정보를 목록 옆 칸에 열고 랭킹은 그대로 둔다', async () => {
  server.use(...mapHandlers);
  const matchMedia = useDesktopViewport();
  try {
    show();
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await user.click(await screen.findByRole('button', { name: '가까이 확대' }));
    await user.click(await screen.findByRole('button', { name: '마커 역삼역 공인중개사' }));
    const agency = within(await screen.findByRole('region', { name: '역삼역 공인중개사 정보' }));
    // 데스크탑은 전화 링크 대신 번호를 보여주고 복사하게 한다.
    expect(agency.queryByRole('link', { name: /전화 걸기/ })).not.toBeInTheDocument();
    expect(agency.getByText('02-555-1201')).toBeInTheDocument();
    await user.click(agency.getByRole('button', { name: '번호 복사' }));
    expect(await agency.findByText('복사했어요')).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe('02-555-1201');
    expect(screen.getByRole('complementary', { name: '통근 시간 상위 동네' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '마커 역삼역' }));
    const stop = within(await screen.findByRole('region', { name: '역삼역 정보' }));
    // 정류장은 그 정류장에서 목적지까지의 경로를 보여준다.
    expect(await stop.findByLabelText('대중교통 경로')).toHaveTextContent('예상');
    await user.click(screen.getByRole('button', { name: '정보 닫기' }));
    expect(screen.queryByRole('region', { name: '역삼역 정보' })).not.toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});
it('통근 서버 오류는 가짜 결과로 대체하지 않는다', async () => {
  server.use(...createCommuteAreaHandlers({ scenario: 'network-unavailable', delayMs: 0 }));
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
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
  expect(screen.getByRole('button', { name: /에서 찾기$/ })).toBeEnabled();
});
it('경계는 조회 버튼 이후에만 원본을 받고 다시 조회하면 캐시를 재사용한다', async () => {
  const paths: string[] = [];
  const track = ({ request }: { request: Request }) => paths.push(new URL(request.url).pathname);
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    expect(paths.filter((path) => path.includes('/boundaries/'))).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(paths.filter((path) => path.endsWith('.geojson'))).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
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
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(requested.sort()).toEqual([files['11'], files['31']]);
  expect(screen.getByRole('button', { name: '역삼1동' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '정자동' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
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
    await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    file = 'admin-dongs.20250630.abcdef123456.geojson';
    await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
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
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
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
  expect(screen.getByRole('button', { name: /에서 찾기$/ })).toBeEnabled();
});

it('위치 선택·분석·결과·다시 선택하기 내내 지도를 새로 만들지 않는다', async () => {
  server.use(...createCommuteAreaHandlers({ delayMs: 50 }));
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
  expect(await screen.findByRole('heading', { name: '주변 동네를 분석하고 있어요' })).toBeInTheDocument();
  // 분석 화면이 덮고 있는 동안에도 지도는 남아 있고, 찾기 버튼은 꺼진다.
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /에서 찾기$/ })).not.toBeInTheDocument();
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
  expect(await screen.findByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(mapMounts.count).toBe(1);
});
it.each([false, true])(
  '공개 탐색 여부 %s: 결과 지도에는 외부 링크를 두지 않고 동네 상세에서 다방을 연다',
  async (isPublic) => {
    show(isPublic);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: /에서 찾기$/ }));
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
    // 정류장·공인중개사는 결과 지도를 확대해 바로 보므로 상세에 주변 분석 링크를 두지 않는다.
    expect(screen.queryByRole('link', { name: /주변 시설 분석/ })).not.toBeInTheDocument();
  },
);
