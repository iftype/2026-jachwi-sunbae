import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

import { commuteBoundaryFixtures } from '@/app/mocks/fixtures/commuteBoundaryFixtures';
import { propertyPageFixture, propertySummaryFixture, successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { adminDongBookmarkHandlers } from '@/app/mocks/handlers/adminDongBookmarkHandlers';
import { createCommuteAreaHandlers } from '@/app/mocks/handlers/commuteAreaHandlers';
import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { createStreetMemoHandlers } from '@/app/mocks/handlers/streetMemoHandlers';
import { writeBookmarkedAdminDongs } from '@/app/mocks/mockStore';
import { RecordsMapProvider } from '@/pages/design-records/RecordsMapProvider';
import NeighborhoodPreviewPage from '@/pages/neighborhood-preview/NeighborhoodPreviewPage';
import NeighborhoodRoutePage from '@/pages/neighborhood-preview/NeighborhoodRoutePage';
import { MapLocationError, readGeolocationPermission, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';
import { MapModeProvider } from '@/shared/ui/map-mode-tile/MapModeContext';

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
        {props.onReady && <button onClick={props.onReady}>지도 준비 완료</button>}
        {props.onDragStart && <button onClick={props.onDragStart}>지도 끌기</button>}
        {props.onSelectLocation && (
          <button onClick={() => props.onSelectLocation?.(37.45, 127.15)}>다른 위치 찍기</button>
        )}
        <output aria-label="지도 시점">{JSON.stringify({ center: props.center, level: props.level })}</output>
        <output aria-label="목적지 좌표">{JSON.stringify(props.markers)}</output>
        <output aria-label="고른 동네 경계">
          {JSON.stringify(props.regions?.find((region) => region.id === props.selectedRegionId)?.polygons ?? [])}
        </output>
        <output aria-label="지도 스타일">{props.customStyleId}</output>
        <output aria-label="지도 안내">{props.tip?.message ?? ''}</output>
        <output aria-label="지도 안내 좌표">
          {props.tip ? JSON.stringify({ latitude: props.tip.latitude, longitude: props.tip.longitude }) : ''}
        </output>
        {props.tip && <button onClick={props.tip.onInteract}>지도 안내 닫기</button>}
        {props.coordinateAction && (
          <button onClick={props.coordinateAction.onClick} disabled={props.coordinateAction.disabled}>
            {props.coordinateAction.label}
          </button>
        )}
        {props.coordinateMenu?.actions.map((action) => (
          <button key={action.id} onClick={action.onSelect}>
            {`말풍선 ${action.label}`}
          </button>
        ))}
        {props.selectedRegionId && (
          <button
            onClick={() => props.onSelectRegion?.(props.selectedRegionId!, { latitude: 37.5, longitude: 127.035 })}
          >
            고른 동네 안 찍기
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
              props.onLevelChange?.(5.3);
              props.onBoundsChange?.({ south: 37.495, west: 127.03, north: 37.506, east: 127.044 });
            }}
          >
            휠로 조금 확대
          </button>
        )}
        {props.onBoundsChange && (
          <button
            onClick={() => {
              // 역삼1동 경계에 맞춘 단계는 마커를 올리는 상한(6.5)이다. 지도는 6.5로 옮겨도 소수 오차를 두고 멈춘다.
              props.onLevelChange?.(6.5000001);
              props.onBoundsChange?.({ south: 37.495, west: 127.03, north: 37.506, east: 127.044 });
            }}
          >
            동네 보기 이동 끝
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
            <button
              key={marker.id}
              aria-pressed={props.selectedMarkerId === marker.id}
              onClick={() => props.onSelectMarker?.(marker)}
            >
              {`마커 ${marker.label}`}
            </button>
          ))}
        {props.bookmarkControl && (
          <button onClick={props.bookmarkControl.onToggle} aria-pressed={props.bookmarkControl.isOn}>
            찜한 동네 토글
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
  // 첫 안내(말풍선)를 이미 봤다는 기록이 다음 테스트로 새지 않게 비운다.
  localStorage.removeItem('jachwi:neighborhood-map-tip-seen');
  vi.mocked(trackPostHogEvent).mockClear();
  vi.mocked(readGeolocationPermission).mockResolvedValue('prompt');
  vi.mocked(requestCurrentMapLocation).mockReset();
  server.use(...createCommuteAreaHandlers({ delayMs: 0 }));
  // 동네를 고르면 주변 분석 카드와 내 매물 통근 시간을 부른다. 테스트마다 따로 두지 않으면 빈 결과로 답한다.
  server.use(
    ...mapHandlers,
    ...createStreetMemoHandlers([]),
    http.get('*/api/properties/commute-times', () =>
      HttpResponse.json(successEnvelope({ maxMinutes: 60, maxTransfers: 2, properties: [] })),
    ),
    http.get('*/api/properties', () => HttpResponse.json(successEnvelope(propertyPageFixture([])))),
  );
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
/** 통합 지도처럼 헤더 왼쪽 `기록으로 전환` 타일이 홈(기록 지도)으로 가게 한다. */
const WithModeSwitch = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  return <MapModeProvider value={{ target: 'records', onSwitch: () => navigate('/') }}>{children}</MapModeProvider>;
};
/** 패널을 접어도 고른 매물 쿼리가 남는지 보려고 지금 주소의 쿼리를 그린다. */
const CurrentSearch = () => <span data-testid="current-search">{useLocation().search}</span>;
type Entry = string | { pathname: string; state: unknown };
const show = (isPublic = false, entries?: Entry[], withRecords = false) => {
  const page = (
    <WithModeSwitch>
      {withRecords ? (
        <RecordsMapProvider>
          <NeighborhoodPreviewPage />
        </RecordsMapProvider>
      ) : (
        <NeighborhoodPreviewPage />
      )}
    </WithModeSwitch>
  );
  // 통합 지도는 출퇴근 장소 검색 화면의 `지도에서 직접 고르기`로 지도 선택을 켜고 들어온다.
  const defaultEntries: Entry[] = isPublic
    ? ['/explore']
    : withRecords
      ? [{ pathname: '/neighborhoods', state: { selectDestinationOnMap: true } }]
      : ['/neighborhoods'];
  const result = render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', commuteDataSource: 'mock' }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={entries ?? defaultEntries} initialIndex={entries ? entries.length - 1 : 0}>
          <CurrentSearch />
          <Routes>
            <Route path="/" element={<h1>홈</h1>} />
            <Route path="/guide" element={<h1>사용 방법</h1>} />
            <Route path="/explore" element={<NeighborhoodPreviewPage />}>
              <Route path="areas/:adminDongCode" element={<NeighborhoodRoutePage />} />
              <Route path="areas/:adminDongCode/details" element={<NeighborhoodRoutePage />} />
            </Route>
            <Route path="/login" element={<h1>로그인 후 방 기록</h1>} />
            <Route path="/neighborhoods" element={page}>
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
/** 동네를 고르면 결과 지도 오른쪽에 두는 분류 레일. */
/**
 * 출퇴근 장소를 고른다. 휴대폰은 지도 선택을 켜고 지도를 찍는다.
 * 지도 선택을 켤 입구가 없는 데스크탑은 출퇴근 장소 검색 결과에서 고른다.
 */
const choosePoint = async () => {
  const user = userEvent.setup();
  if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
    await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  // 데스크탑 왼쪽 조건 칸은 `지도에서 선택`을 눌러야 지도를 눌러 고르는 모드가 켜진다.
  if (screen.queryByRole('button', { name: '지도에서 선택' }))
    await user.click(screen.getByRole('button', { name: '지도에서 선택' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  const canSubmit =
    screen.queryByRole('button', { name: /에서 찾기$/ }) !== null ||
    screen.queryByRole('button', { name: '이 조건으로 동네 찾기' })?.hasAttribute('disabled') === false;
  if (!canSubmit && screen.queryByRole('textbox', { name: '출퇴근 장소' })) {
    await user.type(screen.getByRole('textbox', { name: '출퇴근 장소' }), '서울시청');
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('button', { name: /서울 중구 세종대로 110/ }));
  }
  return user;
};
/** 같은 장소와 조건으로 다시 찾으면 받아 둔 결과를 그대로 쓰므로, 다시 조회해야 하는 테스트는 환승 조건을 바꾼다. */
const changeTransfersToNone = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '환승 1회 이하' }));
  await user.click(screen.getByRole('option', { name: '환승 없음' }));
};
const submitCurrentSearch = async (user: ReturnType<typeof userEvent.setup>) => {
  const legacySubmit = screen.queryByRole('button', { name: /에서 찾기$/ });
  if (legacySubmit) {
    await user.click(legacySubmit);
    return;
  }
  await user.click(screen.getByRole('button', { name: /^통근 \d+분 이내$/ }));
  await user.click(
    within(await screen.findByRole('region', { name: '동네 찾기 필터' })).getByRole('button', {
      name: '이 조건으로 찾기',
    }),
  );
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
    await submitCurrentSearch(user);
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
it('이전 검색 정보가 없는 상세 주소도 오류 안내 대신 위치 선택 지도로 돌아간다', async () => {
  show(true, ['/explore/areas/11230640']);
  expect(await screen.findByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '동네를 먼저 선택해주세요' })).not.toBeInTheDocument();
});
it('공개 통근 탐색은 로그인 없이 결과를 보고 기록 CTA로 로그인에 이어진다', async () => {
  show(true);
  if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
    await userEvent.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  const user = await choosePoint();
  // 위치를 고른 뒤에는 선택 안내 없이 바로 조건을 바꾸거나 찾을 수 있다.
  expect(screen.queryByText('지도에서 출퇴근 장소를 눌러 주세요')).not.toBeInTheDocument();
  expect(screen.queryByText('원하는 조건을 정해주세요')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '통근 40분 이내' }));
  await submitCurrentSearch(user);
  await user.click(await screen.findByRole('button', { name: '이 동네에서 본 방 기록하기' }));
  expect(await screen.findByRole('heading', { name: '로그인 후 방 기록' })).toBeInTheDocument();
  expect(sessionStorage.getItem('jachwi.exploration-journey')).toContain('selectedLocation');
});
it('탐색 기준 선택 화면 없이 바로 지도에서 통근·환승·월세 조건을 함께 고른다', async () => {
  show(true);
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /월세 평균가 보기/ })).not.toBeInTheDocument();
  const conditions = within(screen.getByLabelText('탐색 조건'));
  expect(conditions.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
  expect(conditions.getByRole('button', { name: '환승 1회 이하' })).toBeInTheDocument();
  expect(conditions.getByRole('button', { name: '월세 전체' })).toBeInTheDocument();
  // 조건 칸은 위치를 고르기 전부터 아래 시트에 두고, 찾기 버튼은 위치를 고를 때까지 막아 둔다.
  const sheet = within(screen.getByRole('region', { name: '출퇴근 조건' }));
  expect(sheet.getByLabelText('탐색 조건')).toBeInTheDocument();
  expect(sheet.getByRole('button', { name: '지도에서 출퇴근 장소를 골라 주세요' })).toBeDisabled();
});
it.each([
  [false, ['/guide', '/neighborhoods']],
  [false, ['/', '/neighborhoods', '/neighborhoods/areas/1168064000']],
  [true, ['/', '/explore', '/explore/areas/1168064000']],
])('복귀 버튼은 진입 이력이나 내부 동네 이동과 관계없이 홈으로 간다 (%s, %s)', async (isPublic, entries) => {
  show(isPublic, entries);
  await userEvent.click(
    isPublic
      ? screen.getByRole('button', { name: '홈으로 돌아가기' })
      : screen.getByRole('link', { name: '자취선배 홈' }),
  );
  expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument();
});
it('주소로 바로 들어와도 홈 버튼으로 홈에 간다', async () => {
  show(true);
  await userEvent.click(screen.getByRole('button', { name: '홈으로 돌아가기' }));
  expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument();
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
it('동네를 찾으면 그 출퇴근 장소를 기억해 본 방 기록의 통근 시간 기준으로 쓴다', async () => {
  show();
  const user = await choosePoint();
  expect(localStorage.getItem('jachwi-sunbae:commute-destination')).toBeNull();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(JSON.parse(localStorage.getItem('jachwi-sunbae:commute-destination') ?? 'null')).toEqual(
    expect.objectContaining({ latitude: 37.4, longitude: 127.12 }),
  );
  localStorage.removeItem('jachwi-sunbae:commute-destination');
});
it('월세 조건에 맞는 동네가 없으면 월세 조건을 넓혀보라고 안내한다', async () => {
  // 빈 결과 안내는 데스크탑 공개 탐색의 결과 목록에만 있다(로그인한 회원의 왼쪽 칸은 조건만 둔다).
  const matchMedia = useDesktopViewport();
  try {
    show(true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    // 월세 필터는 결과 지도 안 슬라이더이며, 처음 칸(30만원 이하)으로 줄이면 맞는 동네가 없다.
    // 받아 둔 결과에서 바로 걸러 다시 검색을 누르지 않아도 반영한다.
    const slider = await screen.findByRole('slider', { name: '최대 월세 시세' });
    fireEvent.change(slider, { target: { value: '1' } });
    expect(await screen.findByText('조건에 맞는 동네가 없어요. 월세 조건을 넓혀보세요.')).toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});
it('조건에 맞는 동네가 없으면 통근·환승 조건을 넓혀보라고 안내한다', async () => {
  server.use(
    http.get('*/api/commute-areas/with-rents', () =>
      HttpResponse.json({
        code: 'SUCCESS',
        message: '요청이 성공했습니다.',
        data: { maxMinutes: 40, areaCount: 0, rentStartDate: null, rentEndDate: null, areas: [] },
      }),
    ),
  );
  const matchMedia = useDesktopViewport();
  try {
    show(true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    expect(
      await screen.findByText('조건에 맞는 동네가 없어요. 통근 시간이나 환승 조건을 넓혀보세요.'),
    ).toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});
it('결과가 나오기 전에는 선택 모드를 켜지 않아도 지도 빈 곳을 한 번 누르면 출퇴근 장소로 쓴다', async () => {
  show(true);
  const user = userEvent.setup();
  expect(screen.queryByText('지도에서 출퇴근 장소를 눌러 주세요')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.getByRole('button', { name: /에서 찾기$/ })).toBeEnabled();
});
it('결과가 나오기 전에는 출퇴근 장소가 이미 있어도 지도 빈 곳을 누를 때마다 그 위치로 바뀐다', async () => {
  show(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  await user.click(screen.getByRole('button', { name: '다른 위치 찍기' }));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.45');
});
it('지도에서 선택을 켠 뒤 지도를 한 번 누르면 출퇴근 장소로 쓴다', async () => {
  show(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /^지도에서 (목적지 )?선택$/ }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.queryByRole('button', { name: '출퇴근 장소로 설정' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /에서 찾기$/ })).toBeEnabled();
});

it('모바일 색 기준표는 접거나 펴는 버튼 없이 통근 시간 세 줄만 늘 보여 준다', async () => {
  show(true);
  const user = await choosePoint();
  await submitCurrentSearch(user);

  const legend = await screen.findByLabelText('통근 시간 색상 기준');
  expect(legend).toHaveTextContent('15분 이하');
  expect(legend).toHaveTextContent('16~30분');
  expect(legend).toHaveTextContent('31~40분');
  expect(legend).not.toHaveTextContent('월세 정보 없음');
  expect(screen.queryByRole('button', { name: '표 닫기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '색 기준표 보기' })).not.toBeInTheDocument();
});

it('모바일에서 동네 시트가 열려 있어도 출퇴근 장소 다시 선택 버튼은 시트 위에 떠서 보인다', async () => {
  show();
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.getAllByRole('button', { name: '출퇴근 장소 다시 선택' })).toHaveLength(1);

  await user.click(screen.getByRole('button', { name: '역삼1동' }));
  const sheet = await screen.findByRole('region', { name: /역삼1동/ });
  const reselect = within(sheet).getByRole('button', { name: '출퇴근 장소 다시 선택' });
  expect(screen.getAllByRole('button', { name: '출퇴근 장소 다시 선택' })).toHaveLength(1);
  await user.click(reselect);
  expect(screen.getByRole('textbox', { name: '출퇴근 장소' })).toBeInTheDocument();
});

it('모바일 결과 머리에는 추천 동네 뱃지를 두지 않는다', async () => {
  show();
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });

  expect(screen.queryByLabelText('추천 동네')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^추천 동네 / })).not.toBeInTheDocument();
});

it('첫 진입은 지도이며 위치 권한을 묻지 않고 직접 선택 입구, 하단 확인 화면이 없다', async () => {
  show();
  // 진입만으로는 현재 위치를 묻거나 지도를 옮기지 않는다. 현재 위치는 버튼을 누를 때만 쓴다.
  expect(readGeolocationPermission).not.toHaveBeenCalled();
  expect(requestCurrentMapLocation).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 스타일')).toBeEmptyDOMElement();
  expect(screen.queryByRole('button', { name: '지도에서 직접 선택' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '이 위치로 선택' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '출퇴근 장소' })).not.toHaveFocus();
  expect(screen.queryByRole('spinbutton', { name: '최대 통근 시간' })).not.toBeInTheDocument();
  if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
    await userEvent.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  expect(screen.queryByRole('button', { name: '현재 위치에서 찾기' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '통근 40분 이내' }));
  // 조건 칸을 누르면 시트를 띄우지 않고 카드 안 조건 칸 아래에 그 피커만 펼친다.
  const card = within(screen.getByRole('region', { name: '출퇴근 조건' }));
  expect(screen.queryByRole('button', { name: '상세 패널 높이 조절' })).not.toBeInTheDocument();
  expect(card.getByRole('listbox', { name: '최대 통근 시간' })).toBeInTheDocument();
  expect(screen.queryByRole('listbox', { name: '최대 월세 시세' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '월세 전체' }));
  expect(screen.queryByRole('listbox', { name: '최대 통근 시간' })).not.toBeInTheDocument();
  expect(card.getByRole('listbox', { name: '최대 월세 시세' })).toBeInTheDocument();
  // 같은 칸을 다시 누르면 접는다.
  await userEvent.click(screen.getByRole('button', { name: '월세 전체' }));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.queryByText('통근 시간·환승 조건으로 주변 동네를 찾아봐요.')).not.toBeInTheDocument();
});
it('위치 권한이 있어도 진입만으로는 옮기지 않고, 현재 위치 버튼을 누르면 확대 단계는 그대로 둔 채 그 자리를 고른다', async () => {
  vi.mocked(readGeolocationPermission).mockResolvedValue('granted');
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show();
  const before = JSON.parse(screen.getByLabelText('지도 시점').textContent ?? '{}') as { level: number };
  expect(screen.getByLabelText('지도 시점')).not.toHaveTextContent('37.55');
  expect(screen.queryByRole('button', { name: /에서 찾기$/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  expect(await screen.findByRole('button', { name: /에서 찾기$/ })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55');
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent(`"level":${before.level}`);
  // 현재 위치는 고른 자리 핀으로만 그리고 따로 현재 위치 점을 두지 않는다.
  expect(screen.getByLabelText('목적지 좌표')).not.toHaveTextContent('current-location');
});
it.each([false, true])('지도(공개 %s)에서 현재 위치로 가도 현재 위치 점을 그리지 않는다', async (isPublic) => {
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show(isPublic);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  expect(await screen.findByRole('button', { name: /에서 찾기$/ })).toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).not.toHaveTextContent('current-location');
  if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
    await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  const markers = JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]');
  expect(markers).toEqual([
    expect.objectContaining({
      id: 'destination',
      tone: 'pinLabel',
      pinKind: 'commute',
      latitude: 37.4,
      longitude: 127.12,
    }),
  ]);
});
it('현재 위치 조회 실패 시 지도에서 직접 찍을 수 있다', async () => {
  vi.mocked(requestCurrentMapLocation).mockRejectedValue(new Error('timeout'));
  show();
  await userEvent.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(requestCurrentMapLocation).toHaveBeenCalled());
  await choosePoint();
  expect(screen.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 안내')).toBeEmptyDOMElement();
});
it('주소 검색 결과를 고르면 확대 단계는 그대로 두고 범위 밖이면 중심만 그 자리로 옮긴다', async () => {
  const viewport = useDesktopViewport();
  try {
    show(false, undefined, true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '가까이 확대' }));
    const view = () =>
      JSON.parse(screen.getByLabelText('지도 시점').textContent ?? '{}') as {
        center: { latitude: number };
        level: number;
      };
    expect(view().level).toBe(4);
    await user.type(screen.getByRole('textbox', { name: '출퇴근 장소' }), '서울시청');
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('button', { name: /서울 중구 세종대로 110/ }));
    // 보던 범위(37.495~37.506) 밖의 자리라 중심은 옮기지만, 확대 단계는 그대로다.
    await waitFor(() => expect(view().center.latitude).not.toBeCloseTo(37.5, 1));
    expect(view().level).toBe(4);
  } finally {
    viewport.mockRestore();
  }
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
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.getByLabelText('지도 스타일')).toBeEmptyDOMElement();
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55'));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.getByLabelText('목적지 좌표')).not.toHaveTextContent('current-location');
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
  // 위치를 고르면 조건 칩도 아래 시트로 내려와, 어떤 조건으로 추천받는지 버튼과 함께 보여 준다.
  expect(card.getByText('이 조건으로 추천받아요')).toBeInTheDocument();
  expect(card.getByRole('button', { name: '통근 40분 이내' })).toBeInTheDocument();
  expect(card.getByRole('button', { name: '환승 1회 이하' })).toBeInTheDocument();
  expect(card.getByRole('button', { name: '월세 전체' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 안내')).toBeEmptyDOMElement();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  // 핀은 선택된 출퇴근 장소를 표시한다.
  expect(JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]')).toEqual([
    expect.objectContaining({ id: 'destination', pinKind: 'commute' }),
  ]);
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
});
it.each([false, true])('로그인 여부와 관계없이 주소 검색 결과로 위치를 선택한다 (공개 탐색: %s)', async (isPublic) => {
  server.use(
    http.get('http://localhost:8080/api/maps/search', ({ request }) => {
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
  // 고른 주소를 확인할 수 있게 가까운 단계로 옮긴다.
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent('"level":5');
});
it('통근 필터·조회·동네 선택 및 닫기에도 결과와 시점을 유지한다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '환승 1회 이하' }));
  await user.click(screen.getByRole('option', { name: '환승 없음' }));
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.queryByRole('button', { name: '정자동' })).not.toBeInTheDocument();
  const viewBefore = screen.getByLabelText('지도 시점').textContent;
  await user.click(screen.getByRole('button', { name: '역삼1동' }));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  // 휴대폰은 동네를 골라도 보고 있던 지도 시점을 옮기지 않는다.
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent(viewBefore ?? '');
  // 휴대폰은 동네를 고르면 지도 위 말풍선 대신 아래에 동네 정보 시트를 올린다. 시설 분류 레일은 두지 않는다.
  expect(screen.queryByRole('button', { name: /^교통 표시하기/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '역삼1동 출발 정류장' })).not.toBeInTheDocument();
  // 동네 대중교통 상세로 넘기는 버튼과 닫기 버튼은 두지 않는다.
  expect(screen.queryByRole('button', { name: /대중교통 정보 보기/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '동네 정보 닫기' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '역삼1동' })).toBeInTheDocument();
});
it('휴대폰 지도는 확대, 축소 버튼 없이 결과가 나와도 고르던 지도의 단계를 그대로 둔다', async () => {
  server.use(...mapHandlers, ...createStreetMemoHandlers([]));
  show();
  const user = await choosePoint();
  expect(screen.queryByRole('group', { name: '지도 확대·축소' })).not.toBeInTheDocument();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.queryByRole('group', { name: '지도 확대·축소' })).not.toBeInTheDocument();
  expect(JSON.parse(screen.getByLabelText('지도 시점').textContent ?? '{}').level).toBe(5);
});
it('지도에서 선택을 켜면 안내 띠가 뜨고, 취소하면 사라지며 출퇴근 장소는 그대로다', async () => {
  show(true);
  const user = userEvent.setup();
  expect(screen.queryByText('지도에서 출퇴근 장소를 눌러 주세요')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^지도에서 (목적지 )?선택$/ }));
  expect(screen.getByText('지도에서 출퇴근 장소를 눌러 주세요')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '취소' }));
  expect(screen.queryByText('지도에서 출퇴근 장소를 눌러 주세요')).not.toBeInTheDocument();
});
it('출퇴근 장소 안내는 지도 좌표에 붙는 말풍선으로 띄우고, 지도를 누르거나 끌면 닫아 다시 띄우지 않는다', async () => {
  show(true);
  expect(screen.getByLabelText('지도 안내')).toHaveTextContent('지도를 눌러 출퇴근 장소를 골라요');
  await userEvent.click(screen.getByRole('button', { name: '지도 안내 닫기' }));
  expect(screen.getByLabelText('지도 안내')).toBeEmptyDOMElement();
  // 봤음이 저장돼 다시 열어도 뜨지 않는다.
  expect(localStorage.getItem('jachwi:neighborhood-map-tip-seen')).toBe('true');
});
it('선택 모드에서는 말풍선 대신 안내 띠만 두고, 지도를 누르면 출퇴근 장소로 쓴다', async () => {
  show(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /^지도에서 (목적지 )?선택$/ }));
  expect(screen.getByLabelText('지도 안내')).toBeEmptyDOMElement();
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.queryByText('지도에서 출퇴근 장소를 눌러 주세요')).not.toBeInTheDocument();
});
it('데스크탑도 장소를 고르는 지도에 확대, 축소 버튼을 둔다', async () => {
  const matchMedia = useDesktopViewport();
  try {
    show();
    const zoom = within(await screen.findByRole('group', { name: '지도 확대·축소' }));
    await userEvent.setup().click(zoom.getByRole('button', { name: '지도 확대' }));
    expect((JSON.parse(screen.getByLabelText('지도 시점').textContent ?? '{}') as { level: number }).level).toBe(4);
  } finally {
    matchMedia.mockRestore();
  }
});
it('통근 서버 오류는 가짜 결과로 대체하지 않는다', async () => {
  server.use(...createCommuteAreaHandlers({ scenario: 'network-unavailable', delayMs: 0 }));
  show();
  const user = await choosePoint();
  await submitCurrentSearch(user);
  expect(await screen.findByRole('alert')).toHaveTextContent('동네를 불러오지 못했어요');
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
  const minutes = within(screen.getByRole('listbox', { name: '최대 통근 시간' }));
  expect(minutes.getAllByRole('option')).toHaveLength(6);
  expect(minutes.getByRole('option', { name: '10분 이내' })).toBeInTheDocument();
  expect(minutes.queryByRole('option', { name: '70분 이내' })).not.toBeInTheDocument();
  expect(minutes.getByRole('option', { name: '40분 이내' })).toHaveAttribute('aria-selected', 'true');
  // 고르면 적용 버튼 없이 바로 조건 칸에 반영한다.
  await user.click(minutes.getByRole('option', { name: '30분 이내' }));
  expect(screen.getByRole('button', { name: '통근 30분 이내' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '환승 1회 이하' }));
  const transfers = within(screen.getByRole('listbox', { name: '최대 환승 횟수' }));
  expect(transfers.getAllByRole('option').map((option) => option.textContent)).toEqual([
    '환승 없음',
    '1회 이하',
    '2회 이하',
  ]);
  expect(screen.getByRole('button', { name: /에서 찾기$/ })).toBeEnabled();
});
it('전국 파일 하나뿐인 manifest는 미리 받지 않고, 조회 버튼 이후에 받은 경계를 다시 조회할 때 재사용한다', async () => {
  const paths: string[] = [];
  const track = ({ request }: { request: Request }) => paths.push(new URL(request.url).pathname);
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    // 장소를 고르면 미리 받기가 manifest를 보지만, 시도별 파일이 없으면 큰 전국 파일은 받지 않는다.
    await waitFor(() => expect(paths.filter((path) => path.endsWith('/manifest.json'))).toHaveLength(1));
    expect(paths.filter((path) => path.endsWith('.geojson'))).toHaveLength(0);
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(paths.filter((path) => path.endsWith('.geojson'))).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
    if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
      await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await changeTransfersToNone(user);
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(paths.filter((path) => path.endsWith('.geojson'))).toHaveLength(1);
    // 미리 받기는 화면마다 한 번이라 다시 고를 때는 manifest를 더 받지 않는다.
    expect(paths.filter((path) => path.endsWith('/manifest.json'))).toHaveLength(3);
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
  // 검색에 필요한 파일과 캐시만 검사한다. 별도 테스트가 검증하는 유휴 미리 받기는 여기서 진행하지 않는다.
  vi.stubGlobal('requestIdleCallback', vi.fn());
  try {
    show();
    const user = await choosePoint();
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    // 경기(31)의 정자동은 시세가 없지만 통근 조건에 맞아 `월세 정보 없음`으로 그리므로 경기 경계 파일도 받는다.
    // 결과에 없는 인천(23) 파일은 받지 않는다.
    expect(requested.sort()).toEqual([files['11'], files['31']]);
    expect(screen.getByRole('button', { name: '역삼1동' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '정자동' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
    if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
      await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await changeTransfersToNone(user);
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(requested).toHaveLength(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('지도가 준비되면 수도권 경계를 미리 받아 두고, 검색 뒤에는 경계 파일을 다시 받지 않는다', async () => {
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => window.setTimeout(callback, 0));
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
  try {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '지도 준비 완료' }));
    await waitFor(() => expect(requested).toEqual([files['11'], files['31'], files['23']]));
    if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
      await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(await screen.findByRole('button', { name: '역삼1동' })).toBeInTheDocument();
    expect(requested).toHaveLength(3);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('지도가 준비되기 전에 장소를 고르면 그때 수도권 경계를 미리 받기 시작한다', async () => {
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => window.setTimeout(callback, 0));
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
      requested.push(String(params.filename));
      return HttpResponse.json({ type: 'FeatureCollection', features: [] });
    }),
  );
  try {
    show();
    await choosePoint();
    await waitFor(() => expect(requested).toEqual([files['11'], files['31'], files['23']]));
  } finally {
    vi.unstubAllGlobals();
  }
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
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    file = 'admin-dongs.20250630.abcdef123456.geojson';
    await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
    if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
      await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await changeTransfersToNone(user);
    await submitCurrentSearch(user);
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
  server.use(...createStreetMemoHandlers([]));
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  await user.click(screen.getByRole('button', { name: '다른 위치 찍기' }));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.45');
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(screen.getByRole('button', { name: '역삼1동' }));
  await user.keyboard('{Escape}');
  const markers = JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]');
  // 결과 지도를 찍어도 목적지와 결과는 그대로 두고, 동네 찾기에서는 메모를 남기지 않아 핀도 더하지 않는다.
  if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
    await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]')).toEqual(markers);
  expect(screen.queryByRole('button', { name: /메모 남기기/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
  if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
    await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.queryByRole('region', { name: '행정동 프리셋 지도' })).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: '선택한 동네 정보' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.getByRole('button', { name: /에서 찾기$/ })).toBeEnabled();
});

it('결과가 있을 때 지도를 눌러도 목적지가 바뀌지 않고, 바꾸기를 누르는 순간 이전 결과 동 영역을 지운다', async () => {
  server.use(...createStreetMemoHandlers([]));
  show();
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  const destination = screen.getByLabelText('목적지 좌표').textContent;
  // 결과를 보는 동안 지도를 눌러도 목적지와 결과는 그대로이고 다시 찾기 단계로 넘어가지 않는다.
  if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
    await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.getByLabelText('목적지 좌표').textContent).toBe(destination);
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '역삼1동' })).toBeInTheDocument();
  // 바꾸기를 누르면 새로 찾기 전까지 이전 결과 레이어를 지도에서 걷는다.
  await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
  expect(screen.queryByRole('button', { name: '역삼1동' })).not.toBeInTheDocument();
});

it('위치 선택·분석·결과·다시 선택하기 내내 지도를 새로 만들지 않는다', async () => {
  server.use(...createCommuteAreaHandlers({ delayMs: 50 }));
  show();
  const user = await choosePoint();
  await submitCurrentSearch(user);
  // 분석하는 동안에도 지도는 남아 있고, 찾기 버튼은 꺼진다. 빠른 응답에는 분석 안내가 덮이지 않는다.
  await waitFor(() => expect(screen.queryByRole('button', { name: /에서 찾기$/ })).not.toBeInTheDocument());
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
  expect(await screen.findByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(mapMounts.count).toBe(1);
});
it('데스크탑도 결과 지도를 찍었을 때 메모 말풍선을 띄우지 않는다', async () => {
  server.use(...mapHandlers, ...createStreetMemoHandlers([]));
  const matchMedia = useDesktopViewport();
  try {
    show();
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    if (screen.queryByRole('button', { name: '지도에서 목적지 선택' }))
      await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    expect(screen.queryByRole('button', { name: /메모 남기기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '메모 남기기' })).not.toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});

const markerList = () =>
  JSON.parse(screen.getByLabelText('목적지 좌표').textContent ?? '[]') as {
    id: string;
    label: string;
    category?: string;
    latitude: number;
    longitude: number;
    summary?: { amount: string };
  }[];
it('결과 지도에는 시설 분류 레일을 두지 않고, 출퇴근 장소 핀만 올린다', async () => {
  const paths: string[] = [];
  const track = ({ request }: { request: Request }) => paths.push(new URL(request.url).pathname);
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(screen.queryByRole('complementary', { name: '지도 시설 카테고리' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^병원 표시하기/ })).not.toBeInTheDocument();
    // 순위 카드 줄과 순위 이름표도 두지 않는다.
    expect(screen.queryByLabelText('통근 시간 상위 동네')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '가까이 확대' }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(markerList().map((marker) => marker.id)).toEqual(['destination']);
    expect(paths.filter((path) => path.startsWith('/api/maps/') && path !== '/api/maps/reverse-geocode')).toEqual([]);
  } finally {
    server.events.removeListener('request:start', track);
  }
});
it('휴대폰은 지도에서 동네를 누르면 낮은 시트에 그 동네의 통근, 월세 시세와 다방 링크를 보인다', async () => {
  show();
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await user.click(await screen.findByRole('button', { name: '역삼1동' }));
  const sheet = within(await screen.findByRole('region', { name: '역삼1동' }));
  expect(sheet.getByText('68 / 1,000')).toBeInTheDocument();
  expect(sheet.getByText('소요시간')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /다방에서 역삼1동 원·투룸 보기/ })).toBeInTheDocument();
  // 동네 시트는 낮게 열고, 끌어 올려 더 크게 볼 수 있게 손잡이를 둔다.
  expect(screen.getByRole('button', { name: '상세 패널 높이 조절' })).toBeInTheDocument();
});
it('공개 동네 찾기는 My 칸과 개인 매물 조회를 제공하지 않는다', async () => {
  let propertyRequests = 0;
  const track = ({ request }: { request: Request }) => {
    if (new URL(request.url).pathname.startsWith('/api/properties')) propertyRequests += 1;
  };
  server.events.on('request:start', track);
  try {
    show(true);
    const user = await choosePoint();
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(screen.queryByRole('button', { name: '내 매물 통근 시간 표시하기' })).not.toBeInTheDocument();
    expect(propertyRequests).toBe(0);
  } finally {
    server.events.removeListener('request:start', track);
  }
});
it('공개 탐색 데스크탑 왼쪽 칸은 찾은 동네 카드를 통근 시간 짧은 순으로 두고, 카드를 누르면 그 동네를 고르고 지도 안 카드에 정보를 보인다', async () => {
  const matchMedia = useDesktopViewport();
  try {
    show(true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    const list = within(await screen.findByRole('list', { name: '찾은 동네 목록' }));
    const cards = list.getAllByRole('button');
    // 월세 시세가 없는 동네(정자동)도 통근 조건에 맞으면 목록에 남는다(`시세 없음`).
    expect(cards.map((card) => card.querySelector('strong')?.textContent)).toEqual(['역삼1동', '신림동', '정자동']);
    expect(cards[2]).toHaveTextContent('시세 없음');
    // 월세 필터는 지도 안에 둔다.
    expect(screen.getByRole('slider', { name: '최대 월세 시세' })).toBeInTheDocument();
    await user.click(cards[1]);
    expect(cards[1]).toHaveAttribute('aria-pressed', 'true');
    // 동을 누르면 그 자리에 동 이름, 소요시간, 월세 시세 카드가 뜨고, 마우스를 치워도 띄워 둔다(지도 구역 버튼과 카드 둘).
    expect(screen.getAllByRole('button', { name: /^신림동$/ })).toHaveLength(2);
    // 목록은 그대로 둔다.
    expect(list.getAllByRole('button')).toHaveLength(3);
  } finally {
    matchMedia.mockRestore();
  }
});

it('데스크탑은 결과를 둔 채 조건을 바꿔도 다시 검색을 누를 때만 재조회하고, 지난 검색과 같으면 다시 검색을 막는다', async () => {
  const viewport = useDesktopViewport();
  const requests: string[] = [];
  const track = ({ request }: { request: Request }) => {
    if (new URL(request.url).pathname === '/api/commute-areas/with-rents') requests.push(request.url);
  };
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(requests).toHaveLength(1);
    const saved = Object.keys(sessionStorage).filter((key) => key.startsWith('jachwi.neighborhood-search'));
    const originalSession = saved.map((key) => sessionStorage.getItem(key));
    // 바꾼 조건이 없으면 `다시 검색` 줄 자체를 두지 않는다.
    expect(screen.queryByRole('button', { name: '다시 검색' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '20분' }));
    // 조건만 바꾼 동안에는 결과와 저장된 검색을 그대로 둔다.
    expect(requests).toHaveLength(1);
    expect(saved.map((key) => sessionStorage.getItem(key))).toEqual(originalSession);
    expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '40분' }));
    expect(screen.queryByRole('button', { name: '다시 검색' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '20분' }));
    await user.click(screen.getByRole('button', { name: '다시 검색' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toContain('maxMinutes=20');
  } finally {
    server.events.removeListener('request:start', track);
    viewport.mockRestore();
  }
});

it('이전에 찍은 위치의 늦은 주소 응답이 새 목적지를 덮지 않는다', async () => {
  server.use(
    http.get('*/api/maps/reverse-geocode', async ({ request }) => {
      const latitude = Number(new URL(request.url).searchParams.get('latitude'));
      const isLatest = latitude === 37.45;
      if (!isLatest) await new Promise((resolve) => setTimeout(resolve, 150));
      return HttpResponse.json(
        successEnvelope({
          roadAddress: isLatest ? '최신 목적지' : '이전 목적지',
          jibunAddress: null,
          latitude,
          longitude: 127.12,
        }),
      );
    }),
  );
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  await user.click(screen.getByRole('button', { name: '다른 위치 찍기' }));
  await waitFor(() => expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('최신 목적지'));
  await new Promise((resolve) => setTimeout(resolve, 180));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('최신 목적지');
  expect(screen.getByLabelText('목적지 좌표')).not.toHaveTextContent('이전 목적지');
});

it('모바일은 지도 위 핀으로 목적지 선택을 켜고 결과에서도 헤더로 기록에 돌아간다', async () => {
  show();
  const user = userEvent.setup();
  const toggle = screen.getByRole('button', { name: '지도에서 목적지 선택' });
  const searchHeader = screen.getByRole('textbox', { name: '출퇴근 장소' }).closest('header');
  expect(toggle.closest('header')).toBeNull();
  expect(searchHeader).toContainElement(screen.getByRole('link', { name: '자취선배 홈' }));
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await user.click(toggle);
  expect(screen.getByRole('button', { name: '목적지 선택 취소' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.getByRole('link', { name: '자취선배 홈' }).closest('header')).not.toBeNull();
  await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
  expect(screen.getByRole('button', { name: '이전 결과 보기' }).closest('header')).toBeNull();
  expect(screen.getByRole('button', { name: '지도에서 목적지 선택' }).closest('header')).toBeNull();
  await user.click(screen.getByRole('button', { name: '이전 결과 보기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(screen.getByRole('link', { name: '자취선배 홈' }));
  expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument();
});

it('내 기록이 리스트로 열려 있어도 모바일 동네 찾기는 지도에서 출퇴근 장소를 다시 고른다', async () => {
  show(false, ['/neighborhoods?view=list'], true);
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });

  expect(screen.queryByRole('button', { name: '리스트' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
  expect(screen.getByRole('textbox', { name: '출퇴근 장소' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /에서 찾기$/ })).not.toBeInTheDocument();
});

it('동네 찾기 지도에서는 행정동 안을 눌러도 메모 남기기나 본 방 기록하기 메뉴를 띄우지 않는다', async () => {
  show(false, undefined, true);
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(screen.getByRole('button', { name: '역삼1동' }));
  await user.click(screen.getByRole('button', { name: '고른 동네 안 찍기' }));
  expect(screen.queryByRole('button', { name: '말풍선 메모 남기기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '말풍선 여기에 본 방 기록하기' })).not.toBeInTheDocument();
});

it('모바일 지역 상세에서 찜 버튼을 켜면 추천 동네를 숨기고 찜한 행정동 영역만 뒤 지도에 칠하며, 끄면 되돌린다', async () => {
  writeBookmarkedAdminDongs(['11210690']);
  localStorage.setItem('jachwi:records-bookmark-layer-rail', 'off');
  server.use(...adminDongBookmarkHandlers);
  try {
    show(false, undefined, true);
    const user = await choosePoint();
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    await user.click(screen.getByRole('button', { name: '역삼1동' }));
    await screen.findByRole('region', { name: /역삼1동/ });
    const yeoksamBefore = screen.getAllByRole('button', { name: '역삼1동' }).length;
    const toggle = await screen.findByRole('button', { name: '찜한 동네 토글' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    // 추천 동네(역삼1동) 구역은 걷히고, 찜한 신림동 구역은 남는다.
    await waitFor(() => expect(screen.queryAllByRole('button', { name: '역삼1동' })).toHaveLength(yeoksamBefore - 1));
    expect(screen.getByRole('button', { name: '신림동' })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    await waitFor(() => expect(screen.getAllByRole('button', { name: '역삼1동' })).toHaveLength(yeoksamBefore));
  } finally {
    writeBookmarkedAdminDongs([]);
    localStorage.removeItem('jachwi:records-bookmark-layer-rail');
  }
});

it('모바일 결과에서 월세는 상단 슬라이더로, 통근은 조건을 다시 선택해 바꾼다', async () => {
  show();
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  const rent = screen.getByRole('button', { name: /월세 전체, 눌러서 바꾸기/ });
  await user.click(rent);
  expect(screen.getByRole('slider', { name: '최대 월세 시세' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  await user.click(rent);
  expect(screen.queryByRole('slider', { name: '최대 월세 시세' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
  await user.click(screen.getByRole('button', { name: /^지도에서 (목적지 )?선택$/ }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  const form = within(screen.getByRole('region', { name: '고른 출퇴근 장소' }));
  await user.click(form.getByRole('button', { name: '통근 40분 이내' }));
  await user.click(form.getByRole('option', { name: '50분 이내' }));
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.getByLabelText(/선택한 탐색 조건 통근 50분/)).toBeInTheDocument();
});

it('데스크탑 통합 지도는 왼쪽 조건 칸과 지도 위 찾은 동네 배지를 함께 보여 준다', async () => {
  const viewport = useDesktopViewport();
  server.use(
    http.get('*/api/properties', () =>
      HttpResponse.json(successEnvelope(propertyPageFixture([propertySummaryFixture]))),
    ),
  );
  try {
    show(false, undefined, true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    // 로그인한 회원의 왼쪽 칸은 조건 카드만 두고, 찾은 동네는 지도 위 배지로 본다.
    expect(await screen.findByRole('complementary', { name: '동네 찾기 결과' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '찾은 동네 목록' })).not.toBeInTheDocument();
    // 데스크탑 색 기준표는 월세 정보 없음 줄까지 둔다.
    expect(screen.getByLabelText('통근 시간 색상 기준')).toHaveTextContent('월세 정보 없음');
    const badges = await screen.findByRole('navigation', { name: '찾은 동네' });
    expect(badges.closest('section')).toHaveAttribute('aria-label', '행정동 프리셋 지도');
    // 출퇴근 장소를 다시 고르는 칩이 배지 줄 앞에 따로 있다.
    expect(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' })).toBeInTheDocument();
    const badge = within(badges).getByRole('button', { name: /역삼1동/ });
    await user.click(badge);
    expect(badge).toHaveAttribute('aria-pressed', 'true');
  } finally {
    viewport.mockRestore();
  }
});

it('데스크탑 동네 찾기는 찜한 동네만 보는 동안 지도 위 찾은 동네 뱃지 줄을 숨기고, 끄면 다시 보인다', async () => {
  const viewport = useDesktopViewport();
  writeBookmarkedAdminDongs(['11210690']);
  localStorage.setItem('jachwi:records-bookmark-layer-rail', 'off');
  server.use(...adminDongBookmarkHandlers);
  try {
    show(false, undefined, true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await screen.findByRole('navigation', { name: '찾은 동네' });
    const toggle = await screen.findByRole('button', { name: '찜한 동네 토글' });
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.queryByRole('navigation', { name: '찾은 동네' })).not.toBeInTheDocument();
    // 지도 아래 가운데의 다시 선택 버튼은 뱃지 줄과 따로라 그대로 남는다.
    expect(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' })).toBeInTheDocument();
    await user.click(toggle);
    expect(await screen.findByRole('navigation', { name: '찾은 동네' })).toBeInTheDocument();
  } finally {
    writeBookmarkedAdminDongs([]);
    localStorage.removeItem('jachwi:records-bookmark-layer-rail');
    viewport.mockRestore();
  }
});

it('데스크탑 결과 지도의 출퇴근 장소 다시 선택은 동네 뱃지 줄 밖 지도 아래 가운데에 있고, 선택 모드에서는 보이지 않는다', async () => {
  const viewport = useDesktopViewport();
  try {
    show(false, undefined, true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    const reselect = screen.getByRole('button', { name: '출퇴근 장소 다시 선택' });
    expect(
      within(screen.getByRole('navigation', { name: '찾은 동네' })).queryByText('출퇴근 장소 다시 선택'),
    ).toBeNull();
    expect(reselect.closest('nav')).toBeNull();
    await user.click(reselect);
    expect(screen.queryByRole('button', { name: '출퇴근 장소 다시 선택' })).not.toBeInTheDocument();
  } finally {
    viewport.mockRestore();
  }
});
it('데스크탑 동네 찾기는 선택 전, 선택 중, 주소 검색 중에도 내 매물을 늘 그린다', async () => {
  const viewport = useDesktopViewport();
  useOneRecordedProperty();
  try {
    show(false, undefined, true);
    const user = userEvent.setup();
    const shown = () => markerList().map((marker) => marker.id);
    // 선택 모드로 들어온 직후에도 내 매물을 그린다.
    await screen.findByText('지도에서 출퇴근 장소를 눌러 주세요');
    await waitFor(() => expect(shown()).toContain('my-property:10'));
    // 선택 모드를 끈 처음 진입(조건 입력) 상태에서도 그린다.
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(shown()).toContain('my-property:10');
    // 주소를 입력하며 검색하는 동안에도 그린다.
    await user.type(screen.getByRole('textbox', { name: '출퇴근 장소' }), '서울시청');
    expect(shown()).toContain('my-property:10');
  } finally {
    viewport.mockRestore();
  }
});
const routeRequests = () => {
  const paths: string[] = [];
  const track = ({ request }: { request: Request }) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith('/commute-route')) paths.push(path);
  };
  server.events.on('request:start', track);
  return { paths, stop: () => server.events.removeListener('request:start', track) };
};
it('선택 전에 매물 마커를 눌러도 아무 일도 없고 출퇴근 장소도 잡히지 않는다', async () => {
  const viewport = useDesktopViewport();
  useOneRecordedProperty();
  const requests = routeRequests();
  try {
    show(false, undefined, true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '취소' }));
    await user.click(await screen.findByRole('button', { name: '마커 신림역 원룸' }));
    expect(screen.queryByRole('complementary', { name: '내 매물 정보' })).not.toBeInTheDocument();
    expect(markerList().map((marker) => marker.id)).not.toContain('destination');
    expect(requests.paths).toEqual([]);
  } finally {
    requests.stop();
    viewport.mockRestore();
  }
});
it('선택 모드에서 매물 마커를 눌러도 아무 일도 없고, 지도 빈 곳은 후보를 정한다', async () => {
  const viewport = useDesktopViewport();
  useOneRecordedProperty();
  try {
    show(false, undefined, true);
    const user = userEvent.setup();
    await screen.findByText('지도에서 출퇴근 장소를 눌러 주세요');
    await user.click(await screen.findByRole('button', { name: '마커 신림역 원룸' }));
    expect(screen.queryByRole('complementary', { name: '내 매물 정보' })).not.toBeInTheDocument();
    expect(markerList().map((marker) => marker.id)).not.toContain('destination');
    expect(screen.getByText('지도에서 출퇴근 장소를 눌러 주세요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    expect(markerList().find((marker) => marker.id === 'destination')).toMatchObject({ latitude: 37.4 });
  } finally {
    viewport.mockRestore();
  }
});
it('결과 후 매물 마커를 누르면 접어 둔 패널이 펼쳐지고 지도는 그 매물 쪽으로만 옮긴다(확대 단계는 그대로)', async () => {
  const viewport = useDesktopViewport();
  useOneRecordedProperty();
  try {
    show(false, undefined, true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await screen.findByRole('complementary', { name: '동네 찾기 결과' });
    await user.click(await screen.findByRole('button', { name: '마커 신림역 원룸' }));
    await screen.findByRole('complementary', { name: '내 매물 정보' });
    await user.click(screen.getByRole('button', { name: '상세 접기' }));
    expect(screen.queryByRole('complementary', { name: '내 매물 정보' })).not.toBeInTheDocument();
    const before = JSON.parse(screen.getByLabelText('지도 시점').textContent ?? '{}');
    await user.click(screen.getByRole('button', { name: '마커 신림역 원룸' }));
    expect(await screen.findByRole('complementary', { name: '내 매물 정보' })).toHaveTextContent('신림역 원룸');
    // 지도는 그 매물 쪽으로 옮기되 확대 단계는 그대로 둔다(패널 틀이 없는 테스트 환경에서는 매물 자리가 곧 가운데다).
    const after = JSON.parse(screen.getByLabelText('지도 시점').textContent ?? '{}');
    expect(after.center).toMatchObject({
      latitude: propertySummaryFixture.location.latitude,
      longitude: propertySummaryFixture.location.longitude,
    });
    expect(after.level).toBe(before.level);
  } finally {
    viewport.mockRestore();
  }
});

/** 기록한 매물 하나(신림역 원룸, id 10)와 그 매물의 통근 시간(25분)을 돌려준다. */
const useOneRecordedProperty = () =>
  server.use(
    http.get('*/api/properties', () =>
      HttpResponse.json(successEnvelope(propertyPageFixture([propertySummaryFixture]))),
    ),
    http.get('*/api/properties/commute-times', () =>
      HttpResponse.json(
        successEnvelope({
          maxMinutes: 60,
          maxTransfers: 2,
          properties: [{ propertyId: 10, status: 'REACHABLE', commuteMinutes: 25 }],
        }),
      ),
    ),
  );

it('동네 찾기 지도에도 내 기록과 같은 매물 마커를 올리고, 찜한 동네를 켜도 매물은 걷지 않는다', async () => {
  useOneRecordedProperty();
  writeBookmarkedAdminDongs(['11210690']);
  server.use(...adminDongBookmarkHandlers);
  try {
    show(false, undefined, true);
    const user = await choosePoint();
    // 장소를 고른 뒤 조건을 입력하는 화면에서도 내 매물을 그린다.
    await waitFor(() => expect(markerList().map((marker) => marker.id)).toContain('my-property:10'));
    await submitCurrentSearch(user);
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    const property = markerList().find((marker) => marker.id === 'my-property:10');
    // 내 기록 지도의 매물 마커와 같은 사진 카드에 월세를 적는다.
    expect(property).toMatchObject({ label: '신림역 원룸', tone: 'property', summary: { amount: '55만' } });
    // 결과 지도의 출퇴근 장소 핀은 말풍선 라벨이라 매물 카드보다 위에 온다.
    expect(markerList().find((marker) => marker.id === 'destination')).toMatchObject({ tone: 'pinLabel' });
    const bookmark = await screen.findByRole('button', { name: '찜한 동네 토글' });
    if (bookmark.getAttribute('aria-pressed') !== 'true') await user.click(bookmark);
    await waitFor(() => expect(bookmark).toHaveAttribute('aria-pressed', 'true'));
    expect(markerList().map((marker) => marker.id)).toEqual(expect.arrayContaining(['destination', 'my-property:10']));
  } finally {
    writeBookmarkedAdminDongs([]);
    localStorage.removeItem('jachwi:records-bookmark-layer-rail');
  }
});

it('동네 찾기 결과 지도의 매물 마커를 누르면 그 매물의 정보가 열린다', async () => {
  useOneRecordedProperty();
  show(false, undefined, true);
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(await screen.findByRole('button', { name: '마커 신림역 원룸' }));
  expect(await screen.findByText('서울 관악구 신림로 12')).toBeInTheDocument();
});
it('동네 찾기 결과에서 매물 마커를 눌러도 출퇴근 장소는 바뀌지 않는다', async () => {
  useOneRecordedProperty();
  show(false, undefined, true);
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  const destination = markerList().find((marker) => marker.id === 'destination');
  await user.click(await screen.findByRole('button', { name: '마커 신림역 원룸' }));
  await screen.findByText('서울 관악구 신림로 12');
  expect(markerList().find((marker) => marker.id === 'destination')).toEqual(destination);
  // 마커를 누른 뒤 지도 빈 곳을 눌러도 결과 단계에서는 출퇴근 장소가 바뀌지 않는다.
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(markerList().find((marker) => marker.id === 'destination')).toEqual(destination);
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
});

it('데스크탑 동네 찾기 매물 패널도 `<` 버튼으로 접기만 하고, 고른 매물과 마커 선택은 남긴 채 펼치면 그대로 보인다', async () => {
  const viewport = useDesktopViewport();
  useOneRecordedProperty();
  try {
    show(false, undefined, true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await screen.findByRole('complementary', { name: '동네 찾기 결과' });
    await user.click(await screen.findByRole('button', { name: '마커 신림역 원룸' }));
    expect(await screen.findByRole('complementary', { name: '내 매물 정보' })).toBeInTheDocument();
    const search = screen.getByTestId('current-search').textContent ?? '';
    expect(search).toContain('property=');

    await user.click(screen.getByRole('button', { name: '상세 접기' }));
    expect(screen.queryByRole('complementary', { name: '내 매물 정보' })).not.toBeInTheDocument();
    expect(screen.getByTestId('current-search')).toHaveTextContent(search);
    expect(screen.getByRole('button', { name: '마커 신림역 원룸' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '상세 펼치기' }));
    expect(screen.getByRole('complementary', { name: '내 매물 정보' })).toHaveTextContent('신림역 원룸');
  } finally {
    viewport.mockRestore();
  }
});

/** 지도에 넘긴 시점(가운데와 확대 단계). */
const mapView = () =>
  JSON.parse(screen.getByLabelText('지도 시점').textContent ?? '{}') as {
    center: { latitude: number; longitude: number };
    level: number;
  };
it('휴대폰 결과 지도에서 출퇴근 장소를 다시 고르러 가고 돌아와도 보던 가운데와 확대 단계를 그대로 둔다', async () => {
  show();
  const user = await choosePoint();
  await submitCurrentSearch(user);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  const { center } = mapView();
  // 결과 지도에서 손가락으로 확대한 단계(4)는 다시 그리지 않고 기억만 한다.
  await user.click(screen.getByRole('button', { name: '가까이 확대' }));
  await user.click(screen.getByRole('button', { name: '출퇴근 장소 다시 선택' }));
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(mapView()).toEqual({ center, level: 4 });
  await user.click(screen.getByRole('button', { name: '지도에서 목적지 선택' }));
  expect(mapView()).toEqual({ center, level: 4 });
  await user.click(screen.getByRole('button', { name: '이전 결과 보기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(mapView()).toEqual({ center, level: 4 });
});
it('데스크탑 결과에서 바꾸기나 지도에서 선택을 눌러도 보던 가운데와 확대 단계를 그대로 둔다', async () => {
  const viewport = useDesktopViewport();
  try {
    show(false, undefined, true);
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '이 조건으로 동네 찾기' }));
    await screen.findByRole('complementary', { name: '동네 찾기 결과' });
    const { center } = mapView();
    await user.click(screen.getByRole('button', { name: '가까이 확대' }));
    await user.click(screen.getByRole('button', { name: '바꾸기' }));
    expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
    expect(mapView()).toEqual({ center, level: 4 });
    await user.click(screen.getByRole('button', { name: '지도에서 선택' }));
    expect(mapView()).toEqual({ center, level: 4 });
    // 고른 자리가 보이는 범위 안이면 중심도 옮기지 않고, 찾은 뒤에도 같은 시점을 이어 쓴다.
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    expect(mapView()).toEqual({ center, level: 4 });
  } finally {
    viewport.mockRestore();
  }
});
it.each([false, true])(
  '첫 안내(배너, 칩)로 들어오면 한 번만 첫 안내 말풍선 자리로 옮겨 확대하고, 다른 입구는 보던 지도를 그대로 둔다 (데스크탑: %s)',
  async (isDesktop) => {
    const viewport = isDesktop ? useDesktopViewport() : null;
    try {
      const plain = show();
      // 다른 입구로 들어오면 첫 화면 단계(5) 그대로다.
      const before = mapView();
      expect(before.level).toBe(5);
      const tipAnchor = JSON.parse(screen.getByLabelText('지도 안내 좌표').textContent ?? '{}') as {
        latitude: number;
        longitude: number;
      };
      plain.unmount();
      show(false, [{ pathname: '/neighborhoods', state: { fromFirstPrompt: true } }]);
      // 두 단계 가까이 다가가고, 말풍선이 붙은 자리가 지도 가운데가 된다.
      await waitFor(() => expect(mapView().level).toBe(before.level - 2));
      expect(mapView().center).toEqual(tipAnchor);
      // 한 번만 옮긴다. 그 뒤 사용자가 지도를 움직이면(단계 7) 다시 그려도 끌어오지 않는다.
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '화면 범위 알림' }));
      await user.click(screen.getByRole('button', { name: /^지도에서 (목적지 )?선택$/ }));
      expect(mapView().level).toBe(7);
    } finally {
      viewport?.mockRestore();
    }
  },
);
