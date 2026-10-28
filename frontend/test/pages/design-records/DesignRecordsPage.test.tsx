import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import { createStreetMemoHandlers } from '@/app/mocks/handlers/streetMemoHandlers';
import DesignRecordsPage from '@/pages/design-records/DesignRecordsPage';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: ({
    markers,
    onSelectMarker,
    onSelectLocation,
    onBoundsChange,
    onCenterChange,
    coordinateMenu,
  }: MapCanvasProps) => (
    <div aria-label="예시 지도">
      {markers?.map((marker) => (
        <button key={marker.id} type="button" onClick={() => onSelectMarker?.(marker)}>
          {marker.label}
        </button>
      ))}
      <button type="button" onClick={() => onCenterChange?.(37.5662, 126.9785)}>
        지도 이동
      </button>
      <button type="button" onClick={() => onSelectLocation?.(37.5662, 126.9785)}>
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
    </div>
  ),
}));

const CreateRoute = () => {
  const state = useLocation().state as { selectedLocation?: { latitude: number; roadAddress: string | null } } | null;
  return (
    <>
      <h1>매물 등록 화면</h1>
      <output aria-label="넘겨받은 위치">{JSON.stringify(state?.selectedLocation ?? null)}</output>
    </>
  );
};

beforeEach(() => {
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(...propertyHandlers, ...mapHandlers, ...createStreetMemoHandlers());
});
afterEach(() => {
  resetAuthenticationForTests();
  queryClient.clear();
  sessionStorage.clear();
});

const renderRecords = (initialEntry = '/properties') =>
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/properties/:propertyId?" element={<DesignRecordsPage />} />
            <Route path="/properties/new" element={<CreateRoute />} />
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

it('지도 보기는 지도를 찍어 등록하고, 리스트 보기의 기록하기는 기존 매물 등록 화면으로 이동한다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  expect(screen.queryByRole('button', { name: /기록하기/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /리스트/ }));
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

it('데스크탑은 기록하기 버튼 없이 지도를 찍어 리스트 자리에 매물 등록을 열고 닫는다', async () => {
  const matchMedia = useDesktopViewport();
  const user = userEvent.setup();
  renderRecords();
  await screen.findByRole('heading', { name: '모든 기록' });
  expect(screen.queryByRole('button', { name: /기록하기/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  await user.click(screen.getByRole('button', { name: '말풍선 🏠 여기에 매물 등록' }));
  const panel = within(await screen.findByRole('complementary', { name: '새 매물 등록 패널' }));
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

const viewSwitch = () => within(screen.getByRole('navigation', { name: '기록 보기 방식' }));

it('주소에 리스트 보기가 있으면 리스트로 연다', async () => {
  renderRecords('/properties?view=list');
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

it('휴대폰은 메모 탭을 켠 채로 열어 화면 안 거리 메모를 지도에 올리고 눌러 본다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  // 메모 탭은 카테고리 맨 위에 두고 처음부터 켜 둔다.
  const rail = within(screen.getByRole('complementary', { name: '지도 시설 카테고리' }));
  expect(rail.getAllByRole('button')[0]).toHaveAccessibleName(/^거리 메모 숨기기/);
  expect(rail.getAllByRole('button')[0]).toHaveAttribute('aria-pressed', 'true');
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

it('휴대폰은 지도를 찍어도 추가하지 않고, 매물은 추가 버튼에서 골라 마커를 거둔 지도에서 위치를 찍어 추가한다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  // 마커를 누르려다 잘못 찍기 쉬워, 평소에 지도를 찍으면 아무것도 추가하지 않는다.
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.queryByRole('group', { name: '이 위치에서' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '선택한 위치' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '추가하기' }));
  // + 버튼은 X로 바뀌고, 위로 메모·매물 버튼을 띄운다.
  expect(screen.getByRole('button', { name: '추가 닫기' })).toHaveAttribute('aria-expanded', 'true');
  const choices = within(screen.getByRole('group', { name: '무엇을 추가할까요' }));
  expect(choices.getAllByRole('button').map((button) => button.textContent)).toEqual(['📝 메모', '🏠 매물']);
  await user.click(choices.getByRole('button', { name: '🏠 매물' }));
  const bar = within(screen.getByRole('group', { name: '선택한 위치로 매물 추가' }));
  // 추가 모드에서는 위쪽 탭 대신 추가 중 안내 토스트를 띄우고, 아래에는 버튼만 두며, 지도의 마커를 거둔다. 위치를 찍기 전에는 넘기지 않는다.
  const toast = screen.getByRole('status', { name: '🏠 매물 추가 중' });
  expect(screen.queryByRole('navigation', { name: '기록 보기 방식' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '홈으로 돌아가기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '신림역 원룸' })).not.toBeInTheDocument();
  expect(toast).toHaveTextContent('지도에서 매물 위치를 눌러요');
  expect(bar.getByRole('button', { name: '이 위치로 매물 추가' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  expect(screen.queryByRole('group', { name: '이 위치에서' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '선택한 위치' })).toBeInTheDocument();
  expect(await within(toast).findByText('📍 MSW 테스트 위치 (37.56620, 126.97850)')).toBeInTheDocument();
  await user.click(bar.getByRole('button', { name: '이 위치로 매물 추가' }));
  expect(await screen.findByRole('heading', { name: '매물 등록 화면' })).toBeInTheDocument();
  expect(JSON.parse(screen.getByLabelText('넘겨받은 위치').textContent ?? 'null')).toMatchObject({
    latitude: 37.5662,
    longitude: 126.9785,
  });
});

it('휴대폰 추가 모드는 취소하면 탭과 마커가 있는 원래 지도로 돌아간다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(screen.getByRole('button', { name: '추가하기' }));
  // X를 누르면 고르지 않고 + 버튼으로 돌아간다.
  await user.click(screen.getByRole('button', { name: '추가 닫기' }));
  expect(screen.queryByRole('group', { name: '무엇을 추가할까요' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '추가하기' }));
  await user.click(screen.getByRole('button', { name: '🏠 매물' }));
  await user.click(screen.getByRole('button', { name: '취소' }));
  expect(screen.queryByRole('status', { name: '🏠 매물 추가 중' })).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: '선택한 위치로 매물 추가' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '추가하기' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: '기록 보기 방식' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '신림역 원룸' })).toBeInTheDocument();
});

it('휴대폰 추가 버튼에서 메모를 고르면 찍은 위치에 메모를 남긴다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(screen.getByRole('button', { name: '화면 범위 알림' }));
  await user.click(screen.getByRole('button', { name: '추가하기' }));
  await user.click(screen.getByRole('button', { name: '📝 메모' }));
  const bar = within(screen.getByRole('group', { name: '선택한 위치에 메모 남기기' }));
  await user.click(screen.getByRole('button', { name: '빈 곳 찍기' }));
  expect(await screen.findByText('📍 MSW 테스트 위치 (37.56620, 126.97850)')).toBeInTheDocument();
  await user.click(bar.getByRole('button', { name: '이 위치에 메모 남기기' }));
  expect(screen.queryByRole('group', { name: '선택한 위치에 메모 남기기' })).not.toBeInTheDocument();
  const form = within(await screen.findByRole('region', { name: '메모 남기기' }));
  await user.click(form.getByRole('button', { name: '👍 좋아요' }));
  await user.type(form.getByRole('textbox', { name: '메모' }), '밤에도 밝아요');
  await user.click(form.getByRole('button', { name: '메모 남기기' }));
  // 남긴 뒤에는 상세를 열지 않고, 그 자리에 쓴 글을 잠깐 띄우고 메모 탭을 켜 마커로 남긴다.
  await waitFor(() => expect(screen.queryByRole('region', { name: '메모 남기기' })).not.toBeInTheDocument());
  expect(screen.queryByRole('region', { name: '거리 메모' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^거리 메모 숨기기/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await screen.findAllByRole('button', { name: '밤에도 밝아요' })).toHaveLength(2);
});

it('데스크탑은 찍은 자리 말풍선에서 매물 등록을 고르면 찍은 위치의 주소를 찾아 리스트 자리에 등록을 연다', async () => {
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
    await user.click(screen.getByRole('button', { name: '말풍선 🏠 여기에 매물 등록' }));
    expect(await screen.findByRole('complementary', { name: '새 매물 등록 패널' })).toBeInTheDocument();
    expect(geocoded).toEqual(['?latitude=37.5662&longitude=126.9785']);
  } finally {
    server.events.removeListener('request:start', track);
    matchMedia.mockRestore();
  }
});

it('시설 카테고리를 켜면 반경 원 없이 지도 화면 안의 시설만 올린다', async () => {
  const user = userEvent.setup();
  renderRecords();
  await screen.findByText('신림역 원룸');
  await user.click(screen.getByRole('button', { name: '화면 범위 알림' }));
  await user.click(screen.getByRole('button', { name: /^병원 표시하기/ }));
  expect(await screen.findByRole('button', { name: /^병원 숨기기, \d+개$/ })).toHaveAttribute('aria-pressed', 'true');
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
