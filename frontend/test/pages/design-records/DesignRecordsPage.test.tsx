import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { propertyPageFixture, propertySummaryFixture, successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import { createStreetMemoHandlers } from '@/app/mocks/handlers/streetMemoHandlers';
import { failure, getMockProperties, propertyListItemResponse, success } from '@/app/mocks/mockStore';
import DesignRecordsPage from '@/pages/design-records/DesignRecordsPage';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { rememberMovedProperty, resetMovedPropertyForTests } from '@/features/property/model/movedProperty';
import { SAMPLE_PROPERTIES } from '@/features/property/model/sampleProperties';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: ({
    center,
    level,
    markers,
    onSelectMarker,
    onSelectLocation,
    onBoundsChange,
    onCenterChange,
    coordinateMenu,
    regions,
    bookmarkControl,
    interactive = false,
  }: MapCanvasProps) => (
    <div aria-label="예시 지도">
      <output aria-label="지도 중심">{`${center.latitude},${center.longitude}`}</output>
      <output aria-label="지도 배율">{level}</output>
      {markers?.map((marker) => (
        <button key={marker.id} type="button" onClick={() => onSelectMarker?.(marker)}>
          {marker.label}
        </button>
      ))}
      <button type="button" onClick={() => onCenterChange?.(37.5662, 126.9785)}>
        지도 이동
      </button>
      <button type="button" disabled={!interactive} onClick={() => onSelectLocation?.(37.5662, 126.9785)}>
        빈 곳 찍기
      </button>
      <button
        type="button"
        onClick={() => onBoundsChange?.({ south: 37.56, west: 126.97, north: 37.57, east: 126.99 })}
      >
        화면 범위 알림
      </button>
      {coordinateMenu?.actions.map((action) => (
        <button key={action.id} type="button" onClick={action.onSelect}>
          {`말풍선 ${action.label}`}
        </button>
      ))}
      {bookmarkControl && (
        <button type="button" aria-pressed={bookmarkControl.isOn} onClick={bookmarkControl.onToggle}>
          찜한 동네 토글
        </button>
      )}
      {regions?.map((region) => (
        <span key={region.id} role="img" aria-label={`찜한 영역 ${region.name}`} />
      ))}
    </div>
  ),
}));

beforeEach(() => {
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(...propertyHandlers, ...mapHandlers, ...createStreetMemoHandlers());
});
afterEach(() => {
  resetAuthenticationForTests();
  resetMovedPropertyForTests();
  queryClient.clear();
  sessionStorage.clear();
});

const renderRecords = (initialEntry: string | { pathname: string; state: unknown } = '/') =>
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <MemoryRouter initialEntries={[initialEntry]}>
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

it('내 매물로 지도·리스트와 주소 필터를 구성하고 홈으로 돌아가는 링크를 둔다', async () => {
  const user = userEvent.setup();
  renderRecords();
  expect(await screen.findByText('신림역 원룸')).toBeInTheDocument();
  expect(
    within(screen.getByRole('navigation', { name: '기록 보기 방식' })).getByRole('button', { name: /지도/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  // 휴대폰 폭에서는 하단 탭에 마이가 있어 머리에는 마이페이지 링크를 두지 않는다.
  expect(screen.queryByRole('link', { name: '마이페이지' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /리스트/ }));
  expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /망원동 투룸/ })).toHaveAttribute(
    'href',
    expect.stringMatching(/^\/properties\/\d+$/),
  );
  expect(screen.queryByRole('navigation', { name: '기록한 동네' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '자취선배 홈' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '지도' }));
  const districts = within(screen.getByRole('navigation', { name: '기록한 동네' }));
  await user.click(districts.getByRole('button', { name: /^관악구/ }));
  await user.click(screen.getByRole('button', { name: '리스트' }));
  expect(screen.getByRole('heading', { name: '관악구 기록' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /망원동 투룸/ })).not.toBeInTheDocument();
});

it('휴대폰은 처음 목록에서 매물 기록하기를 누르면 지도로 이동한다', async () => {
  const user = userEvent.setup();
  renderRecords('/?view=list');
  await screen.findByText('신림역 원룸');
  const header = within(screen.getByLabelText('지도 목록 헤더'));
  await user.click(header.getByRole('button', { name: '매물 기록하기' }));
  expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '매물 기록하기' })).not.toBeInTheDocument();
});

it('내 기록의 모바일 리스트는 20개가 넘는 매물도 모두 표시한다', async () => {
  server.use(
    http.get('*/api/properties', () =>
      HttpResponse.json(
        successEnvelope(
          propertyPageFixture(
            Array.from({ length: 25 }, (_, index) => ({
              ...propertySummaryFixture,
              propertyId: index + 1,
              name: `매물 ${index + 1}`,
              location: { address: '서울 강남구', latitude: 37.49 + index * 0.001, longitude: 127.03 },
            })),
          ),
        ),
      ),
    ),
  );
  renderRecords('/?view=list');
  await waitFor(() => expect(screen.getAllByRole('link', { name: /^매물 \d+$/ })).toHaveLength(25));
});

it('필터 없이 각 매물 더보기 메뉴에서 해당 매물을 삭제한다', async () => {
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
  expect(screen.queryByRole('group', { name: '기록 필터 (준비 중)' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '기록 삭제' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '망원동 투룸 메뉴' }));
  await user.click(screen.getByRole('button', { name: '망원동 투룸 삭제' }));
  expect(await screen.findByText('기록을 삭제했어요.')).toBeInTheDocument();
  expect(removed).toHaveBeenCalledOnce();
});

it('매물 더보기 메뉴는 바깥 클릭과 Escape로 닫힌다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(screen.getByRole('button', { name: /리스트/ }));
  const toggle = screen.getByRole('button', { name: '신림역 원룸 메뉴' });
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByRole('heading', { name: '모든 기록' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  await user.keyboard('{Escape}');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveFocus();
});

it('리스트 위에는 통근 시간 버튼을 두지 않고, 동네 찾기에서 출퇴근 장소를 골라 두어도 통근 시간을 부르지 않는다', async () => {
  const user = userEvent.setup();
  const requested = vi.fn();
  server.use(
    http.get('*/api/properties/commute-times', () => {
      requested();
      return new HttpResponse(null, { status: 500 });
    }),
  );
  localStorage.setItem(
    'jachwi-sunbae:commute-destination',
    JSON.stringify({ latitude: 37.4842, longitude: 126.9297, name: '신림역' }),
  );
  try {
    renderRecords();
    await screen.findByText('신림역 원룸');
    await user.click(screen.getByRole('button', { name: /리스트/ }));
    expect(screen.queryByRole('button', { name: '통근 시간' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '바꾸기' })).not.toBeInTheDocument();
    expect(screen.queryByText(/까지 대중교통/)).not.toBeInTheDocument();
    // 미구현 필터 줄은 노출하지 않는다.
    expect(screen.queryByRole('group', { name: '기록 필터 (준비 중)' })).not.toBeInTheDocument();
    expect(requested).not.toHaveBeenCalled();
  } finally {
    localStorage.removeItem('jachwi-sunbae:commute-destination');
  }
});

/** 매물 생성 요청 본문을 모은다. 응답은 기본 MSW 핸들러가 그대로 돌려준다. */
const captureCreatedProperties = () => {
  const bodies: unknown[] = [];
  const track = ({ request }: { request: Request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/properties')
      void request
        .clone()
        .json()
        .then((body) => bodies.push(body));
  };
  server.events.on('request:start', track);
  return { bodies, stop: () => server.events.removeListener('request:start', track) };
};

const quickCreatedBody = {
  name: '새 매물',
  address: 'MSW 테스트 위치 (37.56620, 126.97850)',
  depositAmount: 0,
  monthlyRentAmount: 0,
  latitude: 37.5662,
  longitude: 126.9785,
};

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
  // 리스트에 통근 시간 버튼이 없다. 통근은 동네 찾기에서 다룬다.
  expect(screen.queryByRole('button', { name: '통근 시간' })).not.toBeInTheDocument();
  // 주소 검색창은 공용 레이아웃 밖에서도 헤더 가운데 자리에 들어간다.
  await waitFor(() => expect(screen.getByLabelText('주소 검색')).toBeInTheDocument());
  matchMedia.mockRestore();
});

it('데스크탑 리스트에도 출퇴근 장소와 상관없이 통근 시간 버튼을 두지 않는다', async () => {
  const matchMedia = useDesktopViewport();
  localStorage.setItem(
    'jachwi-sunbae:commute-destination',
    JSON.stringify({ latitude: 37.4842, longitude: 126.9297, name: '신림역' }),
  );
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    expect(screen.queryByRole('button', { name: '통근 시간' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '기록 필터 (준비 중)' })).not.toBeInTheDocument();
  } finally {
    localStorage.removeItem('jachwi-sunbae:commute-destination');
    matchMedia.mockRestore();
  }
});

it('데스크탑은 기록하기 버튼 없이 지도를 찍으면 등록 화면 없이 바로 매물을 만들고 옆 칸에 상세를 연다', async () => {
  const matchMedia = useDesktopViewport();
  const created = captureCreatedProperties();
  const user = userEvent.setup();
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    expect(screen.queryByRole('button', { name: /기록하기/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
    await user.click(screen.getByRole('button', { name: '말풍선 본 방 기록하기' }));
    // 이름은 새 매물로, 보증금과 월세는 0으로 만든다.
    await waitFor(() => expect(created.bodies).toEqual([expect.objectContaining(quickCreatedBody)]));
    expect(await screen.findByRole('complementary', { name: '선택한 매물 상세' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '새 매물 등록' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  } finally {
    created.stop();
    matchMedia.mockRestore();
  }
});

it('체크리스트 탭을 보다가 지도에서 매물을 새로 만들어도 옆 칸 상세는 정보 탭부터 연다', async () => {
  const matchMedia = useDesktopViewport();
  const user = userEvent.setup();
  sessionStorage.setItem('jachwi:property-detail-tab', 'checklist');
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
    await user.click(screen.getByRole('button', { name: '말풍선 본 방 기록하기' }));
    const detail = within(await screen.findByRole('complementary', { name: '선택한 매물 상세' }));
    expect(await detail.findByRole('tab', { name: '정보' })).toHaveAttribute('aria-selected', 'true');
    expect(detail.getByRole('tabpanel', { name: '정보' })).toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});

it('데스크탑에서 지도나 리스트의 방을 누르면 리스트 옆 칸에 매물 상세를 열고, 지도 위 버튼으로 접는다', async () => {
  const matchMedia = useDesktopViewport();
  const user = userEvent.setup();
  renderRecords();
  await screen.findByRole('heading', { name: '모든 기록' });

  await user.click(within(screen.getByLabelText('예시 지도')).getByRole('button', { name: '신림역 원룸' }));
  const detail = within(screen.getByRole('complementary', { name: '선택한 매물 상세' }));
  expect(await detail.findByRole('heading', { level: 1, name: '신림역 원룸' })).toBeInTheDocument();
  expect(detail.getByRole('tablist', { name: '매물 상세 메뉴' })).toBeInTheDocument();
  // 상세는 리스트를 덮지 않으므로 리스트도 함께 보인다.
  expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '매물 카드 닫기' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '매물 상세 칸 닫기' }));
  expect(screen.queryByRole('complementary', { name: '선택한 매물 상세' })).not.toBeInTheDocument();

  // 상세를 연 채로 리스트에서 다른 방을 고르면 옆 칸이 그 방으로 바뀐다.
  await user.click(within(screen.getByLabelText('예시 지도')).getByRole('button', { name: '신림역 원룸' }));
  await within(screen.getByRole('complementary', { name: '선택한 매물 상세' })).findByRole('heading', {
    level: 1,
    name: '신림역 원룸',
  });
  await user.click(screen.getByRole('link', { name: /망원동 투룸/ }));
  expect(
    await within(screen.getByRole('complementary', { name: '선택한 매물 상세' })).findByRole('heading', {
      level: 1,
      name: '망원동 투룸',
    }),
  ).toBeInTheDocument();
  matchMedia.mockRestore();
});

it('데스크탑 리스트에서 방을 누르면 옆 칸에 상세를 열고 지도를 그 방 자리로 옮긴다', async () => {
  const matchMedia = useDesktopViewport();
  const user = userEvent.setup();
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    // 상세 칸에도 주변 지도가 하나 더 생기므로, 상세를 열기 전에 본 방 기록 지도를 잡아 둔다.
    const map = within(screen.getByLabelText('예시 지도'));
    const target = getMockProperties().find((property) => property.name === '신림역 원룸');
    expect(map.getByLabelText('지도 중심')).not.toHaveTextContent(`${target?.latitude},${target?.longitude}`);
    const level = map.getByLabelText('지도 배율').textContent;

    await user.click(screen.getByRole('link', { name: /신림역 원룸/ }));
    // 카드를 누르면 지도 중심이 그 방 자리로 옮겨 가고, 확대 단계는 그대로다.
    expect(map.getByLabelText('지도 중심')).toHaveTextContent(`${target?.latitude},${target?.longitude}`);
    expect(map.getByLabelText('지도 배율')).toHaveTextContent(level ?? '');
    expect(
      await within(screen.getByRole('complementary', { name: '선택한 매물 상세' })).findByRole('heading', {
        level: 1,
        name: '신림역 원룸',
      }),
    ).toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});

const viewSwitch = () => within(screen.getByRole('navigation', { name: '기록 보기 방식' }));

it('주소에 리스트 보기가 있으면 리스트로 연다', async () => {
  renderRecords('/?view=list');
  expect(await screen.findByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  expect(viewSwitch().getByRole('button', { name: /리스트/ })).toHaveAttribute('aria-pressed', 'true');
});

it('마지막으로 고른 보기를 기억해 주소에 보기가 없어도 그 보기로 연다', async () => {
  const user = userEvent.setup();
  const { unmount } = renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(viewSwitch().getByRole('button', { name: /리스트/ }));
  unmount();

  renderRecords();
  expect(await screen.findByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
});

it('휴대폰은 버튼 없이 늘 화면 안 거리 메모를 지도에 올리고 눌러 본다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  // 분류 레일과 메모 버튼은 두지 않고 거리 메모는 늘 켜 둔다.
  expect(screen.queryByRole('complementary', { name: '지도 시설 카테고리' })).not.toBeInTheDocument();
  // 멀리 보면 메모를 동네 묶음으로 보이므로, 동네를 고르고 확대한 뒤 화면 범위를 알린다. 동네를 골라도 확대 단계는 그대로다.
  await user.click(screen.getByRole('button', { name: /^마포구/ }));
  await user.click(screen.getByRole('button', { name: '지도 확대' }));
  await user.click(screen.getByRole('button', { name: '지도 확대' }));
  await user.click(screen.getByRole('button', { name: '화면 범위 알림' }));
  await user.click(await screen.findByRole('button', { name: '늦게까지 여는 세탁소가 있어요.' }));
  const memo = within(await screen.findByRole('region', { name: '거리 메모' }));
  expect(memo.getByText('👍 좋아요')).toBeInTheDocument();
  expect(memo.queryByRole('button', { name: '메모 지우기' })).not.toBeInTheDocument();
  // 열린 메모가 있으면 지도를 찍어도 닫기만 한다.
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.queryByRole('region', { name: '거리 메모' })).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: '이 위치에서' })).not.toBeInTheDocument();
});

it('휴대폰도 데스크탑처럼 빈 곳을 찍은 말풍선에서 매물을 바로 만들고, 상세로 넘어가지 않고 확대 단계는 그대로 둔다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  const levelBefore = screen.getByLabelText('지도 배율').textContent;
  // 아래쪽 추가 버튼 없이, 빈 곳을 찍으면 그 자리 말풍선에서 메모와 매물 중에 고른다.
  expect(screen.queryByRole('button', { name: '추가하기' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.getByRole('button', { name: '말풍선 메모 남기기' })).toBeInTheDocument();
  const created = captureCreatedProperties();
  try {
    await user.click(screen.getByRole('button', { name: '말풍선 본 방 기록하기' }));
    // 등록 화면을 거치지 않고 찍은 위치의 주소로 바로 만든다.
    await waitFor(() => expect(created.bodies).toEqual([expect.objectContaining(quickCreatedBody)]));
    // 지도에 머물러 만든 자리로 다가가고, 새 매물을 아래 시트에 열어 둔다.
    expect(await screen.findByText(/매물을 기록했어요/)).toBeInTheDocument();
    expect(screen.getByLabelText('지도 중심')).toHaveTextContent('37.5662,126.9785');
    expect(screen.getByLabelText('지도 배율')).toHaveTextContent(levelBefore ?? '');
    const sheet = within(await screen.findByRole('region', { name: '선택한 매물' }));
    expect(sheet.getByRole('link', { name: '새 매물' })).toBeInTheDocument();
    // 보증금과 월세가 둘 다 0인 새 매물은 금액 대신 가격 입력 전으로 보인다. 월세만 다루므로 전세로 쓰지 않는다.
    expect(sheet.getByText('가격 입력 전')).toBeInTheDocument();
    expect(screen.queryByText(/전세/)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
  } finally {
    created.stop();
  }
});

it('주소 응답이 늦으면 등록 핀과 확인 중 안내를 먼저 띄우고, 기다리는 동안 다시 찍어도 매물을 하나만 만든다', async () => {
  let respond: () => void = () => undefined;
  server.use(
    http.get(
      '*/api/maps/reverse-geocode',
      () =>
        new Promise<Response>((resolve) => {
          respond = () =>
            resolve(
              success({
                roadAddress: '서울특별시 중구 세종대로 110',
                jibunAddress: null,
                latitude: 37.5662,
                longitude: 126.9785,
              }),
            );
        }),
    ),
  );
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  const created = captureCreatedProperties();
  try {
    await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
    await user.click(screen.getByRole('button', { name: '말풍선 본 방 기록하기' }));
    // 주소를 확인하는 동안 따로 안내 문구는 띄우지 않고, 등록 위치 핀만 둔다.
    expect(await screen.findByRole('button', { name: '새 매물' })).toBeInTheDocument();
    expect(screen.queryByText('주소를 확인하는 중이에요.')).not.toBeInTheDocument();
    // 주소를 기다리는 동안 다시 찍어도 말풍선을 띄우지 않아 두 번 등록하지 못한다.
    await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
    expect(screen.queryByRole('button', { name: '말풍선 본 방 기록하기' })).not.toBeInTheDocument();
    respond();
    expect(await screen.findByText(/매물을 기록했어요/)).toBeInTheDocument();
    expect(created.bodies).toEqual([expect.objectContaining({ address: '서울특별시 중구 세종대로 110' })]);
  } finally {
    created.stop();
  }
});

it.each([
  ['주소를 찾지 못한 자리', () => failure('MAP_ADDRESS_NOT_FOUND', 404)],
  ['주소 조회가 실패한 자리', () => failure('INTERNAL_SERVER_ERROR', 500)],
])('%s도 주소 없이 매물을 만들고, 주소 칸에 지원하지 않는 주소라고 보인다', async (_, respond) => {
  server.use(http.get('*/api/maps/reverse-geocode', respond));
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  const created = captureCreatedProperties();
  try {
    await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
    await user.click(screen.getByRole('button', { name: '말풍선 본 방 기록하기' }));
    await waitFor(() =>
      expect(created.bodies).toEqual([
        expect.objectContaining({ address: null, latitude: 37.5662, longitude: 126.9785 }),
      ]),
    );
    expect(await screen.findByText(/매물을 기록했어요/)).toBeInTheDocument();
    const sheet = within(await screen.findByRole('region', { name: '선택한 매물' }));
    expect(sheet.getByText('지원하지 않는 주소입니다')).toBeInTheDocument();
  } finally {
    created.stop();
  }
});

it('상세에서 위치를 바꿔 저장한 매물이 있으면 첫 기록 대신 그 매물의 새 자리로 지도를 옮겨 고른다', async () => {
  const moved = getMockProperties().find((property) => property.name === '신림역 원룸');
  if (moved?.latitude == null || moved.longitude == null) throw new Error('목 매물 좌표가 없다');
  rememberMovedProperty({ propertyId: moved.id, latitude: moved.latitude, longitude: moved.longitude });
  renderRecords();
  const sheet = within(await screen.findByRole('region', { name: '선택한 매물' }));
  expect(sheet.getByRole('link', { name: '신림역 원룸' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 중심')).toHaveTextContent(`${moved.latitude},${moved.longitude}`);
});

it('휴대폰 지도 아래 매물 시트에서도 더보기 메뉴로 매물을 삭제한다', async () => {
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
  await user.click(within(screen.getByLabelText('예시 지도')).getByRole('button', { name: '신림역 원룸' }));
  const sheet = within(screen.getByRole('region', { name: '선택한 매물' }));
  await user.click(sheet.getByRole('button', { name: '신림역 원룸 메뉴' }));
  await user.click(sheet.getByRole('button', { name: /삭제/ }));
  await waitFor(() => expect(removed).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('기록을 삭제했어요.')).toBeInTheDocument();
});

it('휴대폰에서 지도의 방을 누르면 아래 바텀시트로 보고, 겹친 매물은 함께 늘어놓는다', async () => {
  const [base] = getMockProperties();
  const items = [
    { ...base, id: 9001, name: '같은 건물 3층' },
    { ...base, id: 9002, name: '같은 건물 5층' },
    { ...base, id: 9003, name: '혼자 있는 방', latitude: 37.6, longitude: 127.1 },
  ];
  server.use(
    http.get('*/api/properties', () =>
      success({ totalCount: items.length, items: items.map(propertyListItemResponse) }),
    ),
  );
  const user = userEvent.setup();
  renderRecords();
  await screen.findByRole('button', { name: '혼자 있는 방' });
  const map = within(screen.getByLabelText('예시 지도'));
  // 같은 자리 매물은 개수 핀 하나로 묶는다.
  expect(map.queryByRole('button', { name: '같은 건물 3층' })).not.toBeInTheDocument();
  await user.click(map.getByRole('button', { name: '매물 2개' }));
  const group = within(screen.getByRole('region', { name: '이 자리 매물 2개' }));
  expect(group.getByRole('link', { name: '같은 건물 3층' })).toHaveAttribute('href', '/properties/9001');
  expect(group.getByRole('link', { name: '같은 건물 5층' })).toHaveAttribute('href', '/properties/9002');
  // 열린 시트가 있으면 빈 곳을 찍어도 닫기만 한다.
  await user.click(map.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.queryByRole('region', { name: '이 자리 매물 2개' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '말풍선 본 방 기록하기' })).not.toBeInTheDocument();

  await user.click(map.getByRole('button', { name: '혼자 있는 방' }));
  const single = within(screen.getByRole('region', { name: '선택한 매물' }));
  expect(single.getByRole('link', { name: '혼자 있는 방' })).toHaveAttribute('href', '/properties/9003');
  await user.click(screen.getByRole('button', { name: '매물 닫기' }));
  expect(screen.queryByRole('region', { name: '선택한 매물' })).not.toBeInTheDocument();
});

it('휴대폰은 빈 곳을 찍은 말풍선에서 메모를 고르면 그 위치에 메모를 남긴다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(screen.getByRole('button', { name: /^마포구/ }));
  await user.click(screen.getByRole('button', { name: '화면 범위 알림' }));
  // 동네를 고르면 휴대폰은 그 동네 첫 매물 시트를 열므로, 첫 탭은 시트를 닫기만 한다.
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  await user.click(screen.getByRole('button', { name: '말풍선 메모 남기기' }));
  const form = within(await screen.findByRole('region', { name: '이곳을 평가해 주세요' }));
  await user.click(form.getByRole('button', { name: '👍 좋아요' }));
  await user.type(form.getByRole('textbox', { name: '메모' }), '밤에도 밝아요');
  await user.click(form.getByRole('button', { name: '평가 남기기' }));
  // 남긴 뒤에는 상세를 열지 않고, 그 자리에 메모 말풍선으로 남긴다.
  await waitFor(() => expect(screen.queryByRole('region', { name: '이곳을 평가해 주세요' })).not.toBeInTheDocument());
  expect(screen.queryByRole('region', { name: '거리 메모' })).not.toBeInTheDocument();
  // 따로 떠오르는 말풍선 없이, 남은 메모 말풍선 하나가 그 자리에서 떠오른다.
  expect(await screen.findAllByRole('button', { name: '밤에도 밝아요' })).toHaveLength(1);
});

it('데스크탑은 찍은 자리 말풍선에서 매물 등록을 고르면 찍은 위치의 주소를 찾아 매물을 만든다', async () => {
  const matchMedia = useDesktopViewport();
  const geocoded: string[] = [];
  const track = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/api/maps/reverse-geocode')) geocoded.push(url.search);
  };
  server.events.on('request:start', track);
  const user = userEvent.setup();
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
    // 데스크탑은 아래쪽 버튼 대신 찍은 자리 말풍선으로 고른다.
    expect(screen.queryByRole('group', { name: '이 위치에서' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '말풍선 본 방 기록하기' }));
    expect(await screen.findByRole('complementary', { name: '선택한 매물 상세' })).toBeInTheDocument();
    expect(geocoded).toEqual(['?latitude=37.5662&longitude=126.9785']);
  } finally {
    server.events.removeListener('request:start', track);
    matchMedia.mockRestore();
  }
});

it('기록을 받는 동안에는 기다리지 않고 바로 지금 보기 방식의 영역 하나만 뼈대로 채운다', () => {
  server.use(http.get('*/api/properties', () => new Promise<never>(() => undefined)));
  const view = renderRecords('/?view=map');
  // 화면 코드를 받는 동안의 뼈대에서 이어지도록, 빈 칸으로 두었다가 늦게 띄우지 않는다.
  expect(screen.getByRole('status')).toHaveTextContent('기록을 불러오는 중이에요.');
  expect(screen.getByTestId('map-area-skeleton')).toBeInTheDocument();
  expect(screen.queryByTestId('list-area-skeleton')).not.toBeInTheDocument();
  // 카드와 동네 칩 모양은 그리지 않는다.
  expect(screen.queryByRole('list', { hidden: true })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /전체/ })).not.toBeInTheDocument();
  view.unmount();

  renderRecords('/?view=list');
  expect(screen.getByTestId('list-area-skeleton')).toBeInTheDocument();
  expect(screen.queryByTestId('map-area-skeleton')).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { hidden: true })).not.toBeInTheDocument();
});

it('데스크탑에서 기록을 받는 동안 목록 영역과 지도 영역을 함께 뼈대로 채우고 한 번만 알린다', () => {
  const matchMedia = useDesktopViewport();
  server.use(http.get('*/api/properties', () => new Promise<never>(() => undefined)));
  renderRecords();
  expect(screen.getByRole('status')).toHaveTextContent('기록을 불러오는 중이에요.');
  expect(screen.getByTestId('list-area-skeleton')).toHaveAttribute('role', 'status');
  expect(screen.getByTestId('map-area-skeleton')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.queryByRole('list', { hidden: true })).not.toBeInTheDocument();
  matchMedia.mockRestore();
});

it('기록을 불러오지 못하면 지도 위 헤더 없이 오류 안내와 다시 시도를 보여 준다', async () => {
  let fails = true;
  server.use(
    http.get('*/api/properties', () =>
      fails
        ? HttpResponse.json({ code: 'INTERNAL_SERVER_ERROR', message: '오류', errors: [] }, { status: 500 })
        : HttpResponse.json({ code: 'SUCCESS', message: '성공', data: { totalCount: 0, items: [] } }),
    ),
  );
  const user = userEvent.setup();
  const { container } = renderRecords();
  const alert = within(await screen.findByRole('alert'));
  expect(alert.getByText('기록을 불러오지 못했어요.')).toBeInTheDocument();
  // 지도가 없는 동안 헤더를 지도 위에 띄우면 안내를 가리므로 일반 헤더로 둔다.
  expect(container.querySelector('[class*="mapChrome"]')).toBeNull();
  fails = false;
  await user.click(alert.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
});

it('휴대폰은 헤더의 검색 버튼으로 주소 검색 화면에 가고, 고른 주소가 오면 그 자리로 지도를 옮긴다', async () => {
  renderRecords();
  await screen.findByText('신림역 원룸');
  expect(screen.getByRole('link', { name: '주소 검색' })).toHaveAttribute('href', '/search');
  cleanup();

  // 검색 화면에서 돌아올 때 라우터 상태에 실린 주소로 지도를 옮기고 지도 보기로 바꾼다.
  renderRecords({
    pathname: '/',
    state: {
      searchedAddress: {
        address: null,
        roadAddress: '서울 중구 세종대로 110',
        jibunAddress: null,
        latitude: 37.5665,
        longitude: 126.978,
      },
    },
  });
  await screen.findByText('신림역 원룸');
  await waitFor(() => expect(screen.getByRole('status', { name: '지도 중심' })).toHaveTextContent('37.5665,126.978'));
  expect(
    within(screen.getByRole('navigation', { name: '기록 보기 방식' })).getByRole('button', { name: /지도/ }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('현재 위치 버튼은 받은 위치로 지도를 옮기고, 권한이 없으면 알린다', async () => {
  const originalGeolocation = navigator.geolocation;
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: { latitude: 37.5, longitude: 127.03 } } as GeolocationPosition),
  );
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
  try {
    const user = userEvent.setup();
    renderRecords();
    await screen.findByText('신림역 원룸');
    await user.click(screen.getByRole('button', { name: '현재 위치로 이동' }));
    await waitFor(() => expect(screen.getByRole('status', { name: '지도 중심' })).toHaveTextContent('37.5,127.03'));

    getCurrentPosition.mockImplementation(((_success: PositionCallback, failure?: PositionErrorCallback) =>
      failure?.({ code: 1, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })) as never);
    await user.click(screen.getByRole('button', { name: '현재 위치로 이동' }));
    expect(await screen.findByText(/위치 권한이 꺼져 있어요/)).toBeInTheDocument();
  } finally {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation });
  }
});

it('데스크탑은 리스트에 매물이 모두 보여, 겹친 매물 묶음을 누르면 왼쪽 리스트가 그 자리 매물 목록으로 바뀌고 뒤로가기로 돌아온다', async () => {
  const matchMedia = useDesktopViewport();
  const [base] = getMockProperties();
  const items = [
    { ...base, id: base.id, name: '같은 건물 3층' },
    { ...base, id: 9002, name: '같은 건물 5층' },
  ];
  server.use(
    http.get('*/api/properties', () =>
      success({ totalCount: items.length, items: items.map(propertyListItemResponse) }),
    ),
  );
  const user = userEvent.setup();
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    expect(screen.getByRole('link', { name: /같은 건물 3층/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /같은 건물 5층/ })).toBeInTheDocument();
    await user.click(within(screen.getByLabelText('예시 지도')).getByRole('button', { name: '매물 2개' }));
    // 왼쪽 리스트가 그 자리 매물 목록으로 바뀌고, 지도는 확대하지 않는다.
    expect(screen.getByRole('heading', { name: '이 자리 매물 2개' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '모든 기록' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '전체 리스트로 돌아가기' }));
    expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});

it('본 방 기록 지도에는 분류 레일 없이 확대 축소와 현재 위치만 두고, 통근 시간 버튼도 두지 않는다', async () => {
  localStorage.setItem(
    'jachwi-sunbae:commute-destination',
    JSON.stringify({ latitude: 37.5665, longitude: 126.978, name: '서울시청' }),
  );
  const user = userEvent.setup();
  try {
    renderRecords();
    await screen.findByText('신림역 원룸');
    // 시설 분류(병원, 교통, 학교, 편의)는 동네 찾기 결과 지도로 옮겼다.
    expect(screen.queryByRole('complementary', { name: '지도 시설 카테고리' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '지도 확대·축소' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '현재 위치로 이동' })).toBeInTheDocument();
    // 리스트에는 통근 시간 버튼도, 통근거리 줄과 바꾸기도 두지 않는다.
    await user.click(screen.getByRole('button', { name: /리스트/ }));
    expect(screen.queryByRole('button', { name: '통근 시간' })).not.toBeInTheDocument();
    expect(screen.queryByText(/기준 통근거리/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '바꾸기' })).not.toBeInTheDocument();
  } finally {
    localStorage.removeItem('jachwi-sunbae:commute-destination');
  }
});

it('데스크탑 본 방 기록 지도에도 분류 레일과 통근거리가 없다', async () => {
  const matchMedia = useDesktopViewport();
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    expect(screen.queryByRole('complementary', { name: '지도 시설 카테고리' })).not.toBeInTheDocument();
    expect(screen.queryByText(/까지 통근거리/)).not.toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});

it('데스크탑 옆 칸 상세에서 사진 관리를 누르면 화면을 옮기지 않고 그 칸 안에서 사진을 관리한다', async () => {
  const matchMedia = useDesktopViewport();
  const user = userEvent.setup();
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    await user.click(within(screen.getByLabelText('예시 지도')).getByRole('button', { name: '신림역 원룸' }));
    const detail = within(screen.getByRole('complementary', { name: '선택한 매물 상세' }));
    await user.click(await detail.findByRole('link', { name: /사진 관리/ }));
    // 지도와 리스트는 그대로 두고, 옆 칸만 사진 관리로 바뀐다.
    expect(detail.getByRole('heading', { name: '신림역 원룸 · 사진' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
    await user.click(detail.getByRole('button', { name: '매물 상세로 돌아가기' }));
    expect(detail.getByRole('tablist', { name: '매물 상세 메뉴' })).toBeInTheDocument();
  } finally {
    matchMedia.mockRestore();
  }
});

it('배포 환경에서도 지도를 찍어 메모와 매물 등록을 고를 수 있다', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  try {
    renderRecords();
    expect(await screen.findByRole('button', { name: '빈 곳 찍기' })).toBeEnabled();
  } finally {
    vi.unstubAllEnvs();
  }
});

it('주소가 없는 매물은 목록에 유지하고 주소 미등록 동네 배지를 만들지 않는다', async () => {
  const rooms = getMockProperties();
  server.use(
    http.get('*/api/properties', () =>
      success({
        totalCount: rooms.length,
        items: rooms.map((room) => ({
          ...propertyListItemResponse(room),
          address: null,
        })),
      }),
    ),
  );
  const user = userEvent.setup();
  renderRecords();
  await user.click(await screen.findByRole('button', { name: /리스트/ }));
  await screen.findByText('신림역 원룸');
  expect(screen.queryByRole('navigation', { name: '기록한 동네' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '자취선배 홈' })).toBeInTheDocument();
});

it('지도 탭으로 바로 기록 메뉴를 열고 Escape로 취소한다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.getByRole('button', { name: '말풍선 본 방 기록하기' })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('button', { name: '말풍선 본 방 기록하기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '기록 위치 선택' })).not.toBeInTheDocument();
});

it('데스크톱 목록 헤더에 로고와 검색창, 마이를 함께 둔다', async () => {
  const viewport = useDesktopViewport();
  try {
    renderRecords();
    await screen.findByRole('heading', { name: '모든 기록' });
    const header = within(screen.getByLabelText('지도 목록 헤더'));
    expect(header.getByRole('link', { name: '자취선배 홈' })).toHaveAttribute('href', '/');
    expect(header.getByRole('textbox', { name: '주소 검색' })).toBeInTheDocument();
    expect(header.getByRole('link', { name: '마이페이지' })).toHaveAttribute('href', '/me');
  } finally {
    viewport.mockRestore();
  }
});

it('모바일 헤더에는 동네 찾기 타일 대신 로고를 두고 떠 있는 추천 버튼도 두지 않는다', async () => {
  renderRecords();
  const user = userEvent.setup();
  expect(screen.queryByRole('link', { name: '동네 찾기로 전환' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '자취선배 홈' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '동네 추천받기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '매물 추가' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '리스트' }));
  expect(screen.queryByRole('link', { name: '동네 찾기로 전환' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '주소 검색' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('생활 날씨 안내')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '기록 비교하고 PDF로 받기' })).toHaveAttribute('href', '/compare');
  expect(screen.getByRole('heading', { name: /^기록한 방/ })).toBeInTheDocument();
});

it('예시 매물에도 삭제 메뉴를 두고 서버 요청 없이 숨기며 다시 열어도 유지한다', async () => {
  server.use(http.get('*/api/properties', () => success({ totalCount: 0, items: [] })));
  const requests: string[] = [];
  const track = ({ request }: { request: Request }) => {
    if (request.method === 'DELETE') requests.push(request.url);
  };
  server.events.on('request:start', track);
  try {
    renderRecords('/?view=list');
    const sample = SAMPLE_PROPERTIES[0];
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: `${sample.name} 메뉴` }));
    await user.click(screen.getByRole('button', { name: `${sample.name} 삭제` }));
    expect(await screen.findByText('아직 기록한 방이 없어요')).toBeInTheDocument();
    expect(requests).toEqual([]);
    cleanup();
    renderRecords('/?view=list');
    expect(await screen.findByText('아직 기록한 방이 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `${sample.name} 메뉴` })).not.toBeInTheDocument();
  } finally {
    server.events.removeListener('request:start', track);
  }
});

it('찜한 동네 토글을 켜면 찜한 행정동 영역이 지도에 나타나고, 끄면 사라진다', async () => {
  const bookmarkHandlers = (await import('@/app/mocks/handlers/adminDongBookmarkHandlers')).adminDongBookmarkHandlers;
  const { writeBookmarkedAdminDongs } = await import('@/app/mocks/mockStore');
  writeBookmarkedAdminDongs(['11230640']);
  localStorage.setItem('jachwi:records-bookmark-layer-rail', 'off');
  server.use(
    ...bookmarkHandlers,
    http.get('*/boundaries/manifest.json', () =>
      HttpResponse.json({ version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' }),
    ),
    http.get('*/boundaries/:filename', () =>
      HttpResponse.json({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              code: '11230640',
              name: '역삼1동',
              fullName: '서울특별시 강남구 역삼1동',
              baseDate: '20250630',
            },
            geometry: {
              type: 'MultiPolygon',
              coordinates: [
                [
                  [
                    [127, 37.5],
                    [127, 37.51],
                    [127.01, 37.5],
                    [127, 37.5],
                  ],
                ],
              ],
            },
          },
        ],
      }),
    ),
  );
  renderRecords();
  const toggle = await screen.findByRole('button', { name: '찜한 동네 토글' });
  await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'false'));
  expect(screen.queryByRole('img', { name: '찜한 영역 역삼1동' })).not.toBeInTheDocument();
  await userEvent.click(toggle);
  expect(await screen.findByRole('img', { name: '찜한 영역 역삼1동' })).toBeInTheDocument();
  await userEvent.click(toggle);
  await waitFor(() => expect(screen.queryByRole('img', { name: '찜한 영역 역삼1동' })).not.toBeInTheDocument());
  localStorage.removeItem('jachwi:records-bookmark-layer-rail');
  writeBookmarkedAdminDongs([]);
});
