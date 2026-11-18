import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

import { getMockProperties, propertyListItemResponse } from '@/app/mocks/mockStore';
import CheapMealsPage from '@/pages/cheap-meals/CheapMealsPage';
import { setAuthentication } from '@/features/auth/model/authStore';
import * as mapLocation from '@/features/map/lib/mapLocation';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import { CHEAP_MEALS_PATH, ROUTE_PATTERNS } from '@/shared/lib/navigation/appPaths';

import { server } from '../../server';
import { expectSheetStages } from '../../shared/ui/bottom-sheet/sheetStages';

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));

vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: ({
    onCenterChange,
    onSelectMarker,
    markers = [],
    radiusCenter,
  }: {
    onCenterChange: (lat: number, lng: number) => void;
    onSelectMarker: (marker: { id: string }) => void;
    markers?: { id: string; latitude: number; longitude: number; label: string }[];
    radiusCenter?: { latitude: number; longitude: number };
  }) => (
    <>
      <button onClick={() => onCenterChange(37.5665, 126.978)}>지도 이동 테스트</button>
      <button onClick={() => onCenterChange(37.55, 126.99)}>지도 중간 이동 테스트</button>
      <button onClick={() => onCenterChange(37.3948, 127.1119)}>가게 자리 멈춤 테스트</button>
      <button onClick={() => onSelectMarker({ id: '10' })}>업소 마커 테스트</button>
      {/* 기준 마커와 기록 매물 마커. 가게 마커는 위 버튼으로 대신한다. */}
      {markers
        .filter((marker) => marker.id !== '10' && !/^\d+$/.test(marker.id))
        .map((marker) =>
          marker.id === 'restaurant-base' ? (
            <output key={marker.id} aria-label="기준 마커">{`${marker.latitude},${marker.longitude}`}</output>
          ) : (
            <button key={marker.id} onClick={() => onSelectMarker({ id: marker.id })}>
              {marker.label}
            </button>
          ),
        )}
      {radiusCenter && (
        <output aria-label="반경 원 중심">{`${radiusCenter.latitude},${radiusCenter.longitude}`}</output>
      )}
    </>
  ),
}));
const calls = { promotions: vi.fn(), delivery: vi.fn(), stores: vi.fn() };
const products = Array.from({ length: 60 }, (_, index) => ({
  name: `행사상품 ${index}`,
  price: 4200,
  imageUrl: 'https://example.com/product.png',
  category: 'UNKNOWN',
  promotionType: ['ONE_PLUS_ONE', 'TWO_PLUS_ONE', 'THREE_PLUS_ONE', 'SALE', 'PICK_AND_MIX'][index % 5],
}));
const promotion = (brand: string, values = products, collectedAt: string | null = '2026-10-29T04:00:00+09:00') => ({
  brand,
  count: values.length,
  collectedAt,
  sourceUrl: 'https://example.com/promotions',
  products: values,
});
const offer = {
  id: 1,
  platform: 'BAEMIN',
  brandName: '테스트피자',
  discountAmount: 6000,
  minOrderAmount: 22000,
  startDate: null,
  endDate: null,
  conditions: null,
  lastVerifiedAt: '2026-10-29T09:00:00',
};
const success = (data: unknown) => HttpResponse.json({ code: 'SUCCESS', message: '성공', data });

beforeEach(() => {
  Object.values(calls).forEach((call) => call.mockClear());
  trackEvent.mockClear();
  setAuthentication({ accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 60, memberId: 1 });
  server.use(
    http.get('http://localhost:8080/api/promotions', ({ request }) => {
      const brand = new URL(request.url).searchParams.get('brand') ?? '';
      calls.promotions(brand);
      return success(promotion(brand));
    }),
    http.get('http://localhost:8080/api/delivery-discount-offers', () => {
      calls.delivery();
      return success([
        offer,
        {
          ...offer,
          id: 2,
          platform: 'COUPANG_EATS',
          brandName: '테스트치킨',
          minOrderAmount: null,
          conditions: '참여 매장에 한함',
        },
      ]);
    }),
    http.get('http://localhost:8080/api/maps/good-price-stores', ({ request }) => {
      const url = new URL(request.url);
      calls.stores(url.searchParams.get('radius'), url.searchParams.get('latitude'), url.searchParams.get('longitude'));
      return success({
        center: {
          latitude: Number(url.searchParams.get('latitude')),
          longitude: Number(url.searchParams.get('longitude')),
        },
        radius: Number(url.searchParams.get('radius')),
        count: 1,
        dataAsOf: '2026-06-30',
        stores: [
          {
            id: 10,
            name: '착한 세탁소',
            businessType: '기타비요식업',
            phone: null,
            address: '테스트 주소',
            latitude: 37.3948,
            longitude: 127.1119,
            distanceMeters: 100,
            menus: [{ name: '세탁', price: '5,000~7,000' }],
          },
        ],
      });
    }),
  );
});
const Back = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>브라우저 뒤로</button>;
};
const CurrentUrl = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="현재 주소">{`${pathname}${search}`}</output>;
};
const currentUrl = () => screen.getByRole('status', { name: '현재 주소' }).textContent;
const renderAt = (entry: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <MemoryRouter initialEntries={[entry]}>
          <Back />
          <CurrentUrl />
          <Routes>
            <Route path="/" element={<Link to={CHEAP_MEALS_PATH}>저렴한 한 끼</Link>} />
            <Route path={ROUTE_PATTERNS.cheapMeals} element={<CheapMealsPage />} />
          </Routes>
        </MemoryRouter>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), unmount: view.unmount };
};
const setup = (entry = '/cheap-meals') => renderAt(entry).user;
/** 새로고침처럼 화면을 내리고 지금 주소로 다시 그린다. 탭(세션) 저장소는 그대로 남는다. */
const reload = (unmount: () => void) => {
  const url = currentUrl() ?? '/cheap-meals';
  unmount();
  return renderAt(url);
};
const tab = (name: string) => screen.getByRole('tab', { name });
/** 이름이 같은 기록 매물 둘(시청 근처, 강남). 이름이 같으면 주소로 구분한다. */
const useTwoSameNamedRecords = () => {
  const [base] = getMockProperties();
  const items = [
    { ...base, id: 501, name: '새 매물', address: '서울 중구 세종대로 110', latitude: 37.5665, longitude: 126.978 },
    { ...base, id: 502, name: '새 매물', address: '서울 강남구 테헤란로 1', latitude: 37.5, longitude: 127.03 },
  ];
  server.use(
    http.get('http://localhost:8080/api/properties', () =>
      success({ totalCount: items.length, items: items.map(propertyListItemResponse) }),
    ),
  );
};
/** 화면에 들어온 직후의 지도 이동 알림은 시점 동기화로 무시하므로, 그 시간이 지난 뒤 지도를 옮긴다. */
const moveMap = async (user: ReturnType<typeof setup>, waitForButton = false) => {
  const button = waitForButton
    ? await screen.findByRole('button', { name: '지도 이동 테스트' })
    : screen.getByRole('button', { name: '지도 이동 테스트' });
  await new Promise((resolve) => setTimeout(resolve, 1300));
  await user.click(button);
};

it('다른 화면의 바로가기로 들어오면 고를 카드만 늘어놓던 전체 탭 없이 식당 탭을 바로 열고, 다른 카테고리 API는 미리 부르지 않는다', async () => {
  const user = setup('/');
  await user.click(screen.getByRole('link', { name: '저렴한 한 끼' }));
  expect(screen.queryByRole('tab', { name: '전체' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('tab').map((item) => item.textContent)).toEqual(['식당', '편의점', '배달']);
  expect(tab('식당')).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByRole('list', { name: '가게 목록' })).toBeInTheDocument();
  expect(calls.promotions).not.toHaveBeenCalled();
  expect(calls.delivery).not.toHaveBeenCalled();
});

it('예전 주소의 전체 탭(?tab=all)으로 들어와도 식당 탭으로 연다', async () => {
  setup('/cheap-meals?tab=all');
  expect(tab('식당')).toHaveAttribute('aria-selected', 'true');
  await waitFor(() => expect(currentUrl()).toBe('/cheap-meals/restaurant'));
});

it('처음 다른 화면의 바로가기로 들어오면 이력을 늘리지 않고 식당 탭 주소로 바꾼다', async () => {
  const user = setup('/');
  await user.click(screen.getByRole('link', { name: '저렴한 한 끼' }));
  await waitFor(() => expect(currentUrl()).toBe('/cheap-meals/restaurant'));
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));
  expect(currentUrl()).toBe('/');
});

it('배달 탭을 보다가 다른 화면을 다녀와 다른 화면의 바로가기로 다시 들어오면 배달 탭을 연다', async () => {
  const first = renderAt('/cheap-meals/restaurant');
  await first.user.click(tab('배달'));
  expect(currentUrl()).toBe('/cheap-meals/delivery');
  first.unmount();
  calls.stores.mockClear();

  const { user } = renderAt('/');
  await user.click(screen.getByRole('link', { name: '저렴한 한 끼' }));
  expect(tab('배달')).toHaveAttribute('aria-selected', 'true');
  await waitFor(() => expect(currentUrl()).toBe('/cheap-meals/delivery'));
  expect(calls.stores).not.toHaveBeenCalled();
});

it('탭 주소로 바로 들어오면 마지막 탭보다 주소의 탭을 연다', async () => {
  const first = renderAt('/cheap-meals/delivery');
  first.unmount();
  setup('/cheap-meals/convenience');
  expect(tab('편의점')).toHaveAttribute('aria-selected', 'true');
  expect(currentUrl()).toBe('/cheap-meals/convenience');
});

it.each([
  ['/cheap-meals', '/cheap-meals/restaurant', '식당'],
  ['/cheap-meals?tab=convenience', '/cheap-meals/convenience', '편의점'],
  ['/cheap-meals?tab=delivery', '/cheap-meals/delivery', '배달'],
  ['/cheap-meals/unknown', '/cheap-meals/restaurant', '식당'],
  // 식당 탭 쿼리는 식당 주소에만 남기고, 유입 경로 같은 다른 쿼리는 그대로 둔다.
  ['/cheap-meals?store=10&utm_source=push', '/cheap-meals/restaurant?store=10&utm_source=push', '식당'],
  ['/cheap-meals?tab=delivery&store=10&search=1', '/cheap-meals/delivery', '배달'],
  ['/cheap-meals/convenience?tab=delivery', '/cheap-meals/convenience', '편의점'],
])('예전 주소 %s는 이력을 늘리지 않고 %s로 바꾼다', async (entry, expected, label) => {
  setup(entry);
  // 주소를 바꾸기 전 첫 화면부터 맞는 탭을 그린다.
  expect(tab(label)).toHaveAttribute('aria-selected', 'true');
  await waitFor(() => expect(currentUrl()).toBe(expected));
  expect(tab(label)).toHaveAttribute('aria-selected', 'true');
});

it('탭마다 주소가 따로 있고 다른 탭 주소에는 식당 탭 쿼리를 붙이지 않으며, 뒤로 가면 이전 탭으로 돌아간다', async () => {
  const user = setup('/cheap-meals/restaurant');
  await user.click(await screen.findByRole('button', { name: '업소 마커 테스트' }));
  expect(currentUrl()).toBe('/cheap-meals/restaurant?store=10');
  await user.click(tab('편의점'));
  expect(currentUrl()).toBe('/cheap-meals/convenience');
  await user.click(tab('배달'));
  expect(currentUrl()).toBe('/cheap-meals/delivery');
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));
  expect(currentUrl()).toBe('/cheap-meals/convenience');
  expect(tab('편의점')).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));
  expect(currentUrl()).toBe('/cheap-meals/restaurant?store=10');
  expect(tab('식당')).toHaveAttribute('aria-selected', 'true');
});

it('가게 목록을 닫고 다른 화면에 다녀와도 닫힌 상태로 돌아온다', async () => {
  const first = renderAt('/cheap-meals/restaurant');
  await first.user.click(await screen.findByRole('button', { name: '가게 목록 닫기' }));
  const second = reload(first.unmount);

  expect(await screen.findByRole('button', { name: /가게 목록 보기/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '가게 목록 닫기' })).not.toBeInTheDocument();
  await second.user.click(screen.getByRole('button', { name: /가게 목록 보기/ }));
  expect(screen.getByRole('button', { name: '가게 목록 닫기' })).toBeInTheDocument();
});

it('기록 매물 마커를 누르면 그 매물이 기준이 되어 기준 마커, 원, 조회 좌표가 옮겨 가고 다른 탭을 다녀와도 남는다', async () => {
  useTwoSameNamedRecords();
  const user = setup('/cheap-meals/restaurant');
  // 이름이 같은 매물은 주소로 구분한다. 처음 기준은 가장 최근 기록 매물(시청 근처)이라, 강남 매물은 마커로 보인다.
  await user.click(await screen.findByRole('button', { name: '새 매물(서울 강남구 테헤란로 1) 기준으로 보기' }));
  expect(
    await screen.findByRole('status', { name: '새 매물(서울 강남구 테헤란로 1) 기준으로 보고 있어요' }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('기준 마커')).toHaveTextContent('37.5,127.03');
  expect(screen.getByLabelText('반경 원 중심')).toHaveTextContent('37.5,127.03');
  await waitFor(() => expect(calls.stores).toHaveBeenLastCalledWith('2000', '37.5', '127.03'));
  await user.click(tab('편의점'));
  await user.click(tab('식당'));
  expect(currentUrl()).toBe('/cheap-meals/restaurant');
  expect(screen.getByLabelText('기준 마커')).toHaveTextContent('37.5,127.03');
  expect(calls.stores).toHaveBeenLastCalledWith('2000', '37.5', '127.03');
  // 기준이 된 매물은 마커가 겹치지 않게 기준 마커가 대신하고, 이전 기준 매물이 다시 마커로 보인다.
  expect(
    screen.queryByRole('button', { name: '새 매물(서울 강남구 테헤란로 1) 기준으로 보기' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '새 매물(서울 중구 세종대로 110) 기준으로 보기' })).toBeInTheDocument();
});

it('업종 칩으로 식당 목록을 거르고 다시 누르면 전체 업종으로 돌아간다', async () => {
  const shop = (id: number, name: string, businessType: string) => ({
    id,
    name,
    businessType,
    phone: null,
    address: '테스트 주소',
    latitude: 37.3948,
    longitude: 127.1119,
    distanceMeters: 100 * id,
    menus: [],
  });
  server.use(
    http.get('http://localhost:8080/api/maps/good-price-stores', () =>
      success({
        center: { latitude: 37.3948, longitude: 127.1112 },
        radius: 2000,
        count: 3,
        dataAsOf: '2026-06-30',
        stores: [shop(1, '스시집', '일식'), shop(2, '국밥집', '한식'), shop(3, '세탁소', '기타비요식업')],
      }),
    ),
  );
  const user = setup('/cheap-meals/restaurant');
  const list = await screen.findByRole('list', { name: '가게 목록' });
  const chips = within(screen.getByRole('group', { name: '업종으로 거르기' }));
  expect(chips.getAllByRole('button').map((chip) => chip.textContent)).toEqual([
    '전체 3',
    '기타비요식업 1',
    '일식 1',
    '한식 1',
  ]);
  expect(chips.getByRole('button', { name: '전체 3' })).toHaveAttribute('aria-pressed', 'true');

  await user.click(chips.getByRole('button', { name: '한식 1' }));
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  expect(within(list).getByRole('button', { name: '국밥집 상세 보기' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '착한가격 가게 1곳' })).toBeInTheDocument();

  await user.click(chips.getByRole('button', { name: '한식 1' }));
  expect(within(screen.getByRole('list', { name: '가게 목록' })).getAllByRole('listitem')).toHaveLength(3);
});

it('가게 상세를 연 채 새로고침하면 판교로 돌아가지 않고 고른 기준에서 같은 가게를 다시 연다', async () => {
  useTwoSameNamedRecords();
  const first = renderAt('/cheap-meals/restaurant');
  await first.user.click(await screen.findByRole('button', { name: '새 매물(서울 강남구 테헤란로 1) 기준으로 보기' }));
  await waitFor(() => expect(calls.stores).toHaveBeenLastCalledWith('2000', '37.5', '127.03'));
  await first.user.click(await screen.findByRole('button', { name: '착한 세탁소 상세 보기' }));
  expect(currentUrl()).toBe('/cheap-meals/restaurant?store=10');
  calls.stores.mockClear();

  reload(first.unmount);
  expect(await screen.findByRole('link', { name: /길찾기/ })).toBeInTheDocument();
  expect(screen.getByLabelText('기준 마커')).toHaveTextContent('37.5,127.03');
  expect(calls.stores).toHaveBeenCalledTimes(1);
  expect(calls.stores).toHaveBeenCalledWith('2000', '37.5', '127.03');
});

it('지금 동네 목록에 없는 가게 주소로 들어오면 목록을 보여 주고 주소에서 가게를 지운다', async () => {
  setup('/cheap-meals/restaurant?store=999');
  expect(await screen.findByRole('list', { name: '가게 목록' })).toBeInTheDocument();
  await waitFor(() => expect(currentUrl()).toBe('/cheap-meals/restaurant'));
  expect(screen.queryByRole('link', { name: /길찾기/ })).not.toBeInTheDocument();
});
it('상품은 24개씩 표시하고 추가 행사 유형과 UNKNOWN 상품도 전체 목록에 남는다', async () => {
  const user = setup('/cheap-meals/convenience');
  const list = await screen.findByRole('list', { name: '행사상품 목록' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(24);
  await user.click(screen.getByRole('button', { name: /상품 더 보기/ }));
  expect(within(list).getAllByRole('listitem')).toHaveLength(48);
  await user.click(screen.getByRole('radio', { name: '기타 행사' }));
  expect(within(list).getAllByRole('listitem')).toHaveLength(24);
  expect(within(list).getAllByText('3+1')).toHaveLength(12);
  expect(within(list).getAllByText('골라담기')).toHaveLength(12);
});
// 이름은 콜라·라면이 번갈아 나오고, 판매가격은 응답 순서와 반대로 내려가 정렬 여부가 첫 상품에서 드러난다.
const searchableProducts = Array.from({ length: 60 }, (_, index) => ({
  ...products[0],
  name: index % 2 === 0 ? `콜라 ${index}` : `라면 ${index}`,
  price: 10000 - index * 10,
  promotionType: index < 40 ? 'ONE_PLUS_ONE' : 'TWO_PLUS_ONE',
}));
const useSearchableProducts = () =>
  server.use(http.get('http://localhost:8080/api/promotions', () => success(promotion('EMART24', searchableProducts))));
const cardNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole('button')
    .map((card) => card.getAttribute('aria-label')?.replace(' 상세 보기', ''));
const searchInput = () => screen.getByRole('textbox', { name: '상품명 검색' });
const sortSelect = () => screen.getByRole('combobox', { name: '가격 정렬' });

it('상품명 검색은 전체 상품에서 대소문자·공백을 무시해 찾고, 결과 수와 더 보기를 함께 적용한다', async () => {
  useSearchableProducts();
  const user = setup('/cheap-meals?tab=convenience');
  const list = await screen.findByRole('list', { name: '행사상품 목록' });
  expect(sortSelect()).toHaveValue('DEFAULT');
  await user.type(searchInput(), ' 콜 라');
  expect(screen.getByText('이마트24 · 검색 결과 30개 상품')).toBeInTheDocument();
  expect(cardNames(list)).toHaveLength(24);
  expect(cardNames(list).every((name) => name?.startsWith('콜라'))).toBe(true);
  await user.click(screen.getByRole('button', { name: '상품 더 보기 (24/30)' }));
  expect(cardNames(list)).toHaveLength(30);
  expect(screen.queryByRole('button', { name: /상품 더 보기/ })).not.toBeInTheDocument();
  // 기존 행사 유형 필터와 함께 걸리고, 조건이 바뀌면 다시 24개부터 보여 준다.
  await user.click(screen.getByRole('radio', { name: '2+1' }));
  expect(screen.getByText('이마트24 · 검색 결과 10개 상품')).toBeInTheDocument();
  expect(cardNames(list)).toEqual([
    '콜라 40',
    '콜라 42',
    '콜라 44',
    '콜라 46',
    '콜라 48',
    '콜라 50',
    '콜라 52',
    '콜라 54',
    '콜라 56',
    '콜라 58',
  ]);
  await user.click(screen.getByRole('radio', { name: '전체' }));
  expect(cardNames(list)).toHaveLength(24);
  await user.clear(searchInput());
  expect(screen.getByText('이마트24 · 60개 상품')).toBeInTheDocument();
});
it('가격순 정렬은 보이는 24개가 아니라 검색·필터를 거친 전체 결과에 적용되고 더 보기에서도 이어진다', async () => {
  useSearchableProducts();
  const user = setup('/cheap-meals?tab=convenience');
  const list = await screen.findByRole('list', { name: '행사상품 목록' });
  await user.click(screen.getByRole('button', { name: /상품 더 보기/ }));
  expect(cardNames(list)).toHaveLength(48);
  await user.selectOptions(sortSelect(), '가격 낮은 순');
  // 응답의 마지막 상품이 가장 싸므로, 전체를 정렬해야만 첫 자리에 온다. 정렬을 바꾸면 24개로 돌아간다.
  expect(cardNames(list)).toHaveLength(24);
  expect(cardNames(list).slice(0, 3)).toEqual(['라면 59', '콜라 58', '라면 57']);
  await user.click(screen.getByRole('button', { name: /상품 더 보기/ }));
  expect(cardNames(list).slice(23, 26)).toEqual(['콜라 36', '라면 35', '콜라 34']);
  await user.selectOptions(sortSelect(), '가격 높은 순');
  expect(cardNames(list).slice(0, 2)).toEqual(['콜라 0', '라면 1']);
  await user.type(searchInput(), '라면');
  await user.click(screen.getByRole('radio', { name: '1+1' }));
  expect(cardNames(list)).toHaveLength(20);
  expect(cardNames(list).slice(0, 2)).toEqual(['라면 1', '라면 3']);
  await user.selectOptions(sortSelect(), '가격 낮은 순');
  expect(cardNames(list).slice(0, 2)).toEqual(['라면 39', '라면 37']);
  await user.selectOptions(sortSelect(), '기본순');
  expect(cardNames(list).slice(0, 2)).toEqual(['라면 1', '라면 3']);
});
it('검색 결과가 없으면 검색 빈 상태를 보여 주고 API의 빈 목록과 구분한다', async () => {
  useSearchableProducts();
  const user = setup('/cheap-meals?tab=convenience');
  await screen.findByRole('list', { name: '행사상품 목록' });
  await user.type(searchInput(), '우유');
  expect(screen.getByText('이마트24 · 검색 결과 0개 상품')).toBeInTheDocument();
  expect(screen.getByText('검색어와 일치하는 상품이 없어요')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '행사상품 목록' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /상품 더 보기/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
  expect(await screen.findByRole('list', { name: '행사상품 목록' })).toBeInTheDocument();
});
it('등록된 행사상품이 없으면 검색 중이어도 검색 결과 0건이 아니라 빈 목록 안내를 보여 준다', async () => {
  server.use(http.get('http://localhost:8080/api/promotions', () => success(promotion('EMART24', []))));
  const user = setup('/cheap-meals?tab=convenience');
  expect(await screen.findByText('현재 등록된 행사상품이 없어요')).toBeInTheDocument();
  await user.type(searchInput(), '콜라');
  expect(screen.getByText('현재 등록된 행사상품이 없어요')).toBeInTheDocument();
  expect(screen.queryByText('검색어와 일치하는 상품이 없어요')).not.toBeInTheDocument();
});
it('편의점 검색어와 정렬은 탭을 오가도 유지된다', async () => {
  useSearchableProducts();
  const user = setup();
  await user.click(tab('편의점'));
  const list = await screen.findByRole('list', { name: '행사상품 목록' });
  await user.type(searchInput(), '라면');
  await user.selectOptions(sortSelect(), '가격 낮은 순');
  await user.click(tab('식당'));
  await user.click(tab('배달'));
  await screen.findByRole('list', { name: '배달 혜택 목록' });
  await user.click(tab('편의점'));
  expect(searchInput()).toHaveValue('라면');
  expect(sortSelect()).toHaveValue('PRICE_ASC');
  expect(cardNames(list)[0]).toBe('라면 59');
});
it('브랜드·1+1 필터·배달 플랫폼이 탭을 오가도 유지된다', async () => {
  const user = setup();
  await user.click(tab('편의점'));
  await screen.findByRole('list', { name: '행사상품 목록' });
  await user.click(screen.getByRole('radio', { name: '세븐일레븐' }));
  await waitFor(() => expect(calls.promotions).toHaveBeenCalledWith('SEVEN_ELEVEN'));
  await screen.findByRole('list', { name: '행사상품 목록' });
  await user.click(screen.getByRole('radio', { name: '1+1' }));
  await user.click(tab('배달'));
  await screen.findByRole('list', { name: '배달 혜택 목록' });
  await user.click(screen.getByRole('radio', { name: '배민' }));
  expect(screen.queryByRole('button', { name: /테스트치킨 할인 상세/ })).not.toBeInTheDocument();
  await user.click(tab('편의점'));
  expect(screen.getByRole('radio', { name: '세븐일레븐' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: '1+1' })).toHaveAttribute('aria-checked', 'true');
  await user.click(tab('배달'));
  expect(screen.getByRole('radio', { name: '배민' })).toHaveAttribute('aria-checked', 'true');
});
it('이미지 실패를 대체하고 상세에서 실제 판매가격·UNKNOWN·공식 링크를 표시한다', async () => {
  const user = setup('/cheap-meals/convenience');
  const image = await screen.findByRole('img', { name: '행사상품 0' });
  fireEvent.error(image);
  expect(screen.getByRole('img', { name: '행사상품 0 이미지 없음' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '행사상품 0 상세 보기' }));
  const sheet = within(screen.getByRole('dialog', { name: '상품 상세' }));
  expect(sheet.getByText('4,200원')).toBeInTheDocument();
  expect(sheet.queryByText('2,100원')).not.toBeInTheDocument();
  expect(sheet.getByText('카테고리 정보 없음')).toBeInTheDocument();
  expect(sheet.getByRole('link', { name: /공식 행사/ })).toHaveAttribute('href', 'https://example.com/promotions');
  expect(document.body.style.overflow).toBe('hidden');
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(tab('편의점')).toHaveAttribute('aria-selected', 'true');
  expect(document.body.style.overflow).toBe('');
});
it('배달 상세는 금액과 null 조건을 보여주고 주문 링크를 만들지 않는다', async () => {
  const user = setup('/cheap-meals/delivery');
  await user.click(await screen.findByRole('button', { name: /배민 테스트피자 할인 상세/ }));
  const sheet = within(screen.getByRole('dialog', { name: '할인 상세' }));
  expect(sheet.getByText('6,000원 할인')).toBeInTheDocument();
  expect(sheet.getByText('22,000원')).toBeInTheDocument();
  expect(sheet.getAllByText('정보 없음')).toHaveLength(3);
  expect(sheet.queryByRole('link')).not.toBeInTheDocument();
  await user.click(sheet.getByRole('button', { name: '상세 닫기' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('미수집 0건을 서버 오류와 구분한다', async () => {
  server.use(http.get('http://localhost:8080/api/promotions', () => success(promotion('EMART24', [], null))));
  setup('/cheap-meals/convenience');
  expect(await screen.findByText('아직 행사정보를 수집하지 않았어요')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
});
it('현재 유효한 배달 혜택 0건을 그대로 표시한다', async () => {
  server.use(http.get('http://localhost:8080/api/delivery-discount-offers', () => success([])));
  setup('/cheap-meals/delivery');
  expect(await screen.findByText('현재 유효한 할인정보가 없어요')).toBeInTheDocument();
});
it('서버 실패 후 다시 시도하면 실제 응답 목록으로 복구한다', async () => {
  let failed = true;
  server.use(
    http.get('http://localhost:8080/api/promotions', () =>
      failed ? new HttpResponse(null, { status: 500 }) : success(promotion('EMART24')),
    ),
  );
  const user = setup('/cheap-meals/convenience');
  const retry = await screen.findByRole('button', { name: '다시 시도' });
  failed = false;
  await user.click(retry);
  expect(await screen.findByRole('list', { name: '행사상품 목록' })).toBeInTheDocument();
});
it('식당의 원본 업종을 표시하고 탭 복귀에도 2km 반경을 유지한다', async () => {
  const user = setup('/cheap-meals/restaurant');
  expect((await screen.findAllByText(/기타비요식업/)).length).toBeGreaterThan(0);
  expect(calls.stores).toHaveBeenCalledWith('2000', expect.any(String), expect.any(String));
  expect(screen.queryByRole('group', { name: '탐색 반경' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^(500m|1km|2km)$/ })).not.toBeInTheDocument();
  await user.click(tab('편의점'));
  await user.click(tab('식당'));
  expect(calls.stores).toHaveBeenLastCalledWith('2000', expect.any(String), expect.any(String));
  // 지도를 끌어도 기준은 바뀌지 않아 다시 찾지 않는다.
  const before = calls.stores.mock.calls.length;
  await moveMap(user);
  expect(screen.queryByRole('button', { name: '이 위치에서 찾기' })).not.toBeInTheDocument();
  expect(calls.stores).toHaveBeenCalledTimes(before);
  await user.click(await screen.findByRole('button', { name: '착한 세탁소 상세 보기' }));
  expect(screen.getByRole('link', { name: /길찾기/ })).toHaveAttribute(
    'href',
    expect.stringContaining('map.kakao.com/link/to/'),
  );
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));
  expect(screen.getByRole('list', { name: '가게 목록' })).toBeInTheDocument();
});

it('지도를 연달아 끌어도 기준과 원은 그대로이고 다시 찾지 않는다', async () => {
  const user = setup('/cheap-meals/restaurant');
  expect((await screen.findAllByText(/기타비요식업/)).length).toBeGreaterThan(0);
  const before = calls.stores.mock.calls.length;
  const base = screen.getByLabelText('기준 마커').textContent;
  await user.click(screen.getByRole('button', { name: '지도 중간 이동 테스트' }));
  await moveMap(user);
  await new Promise((resolve) => setTimeout(resolve, 600));
  expect(screen.getByRole('list', { name: '가게 목록' })).toBeInTheDocument();
  expect(calls.stores).toHaveBeenCalledTimes(before);
  expect(screen.getByLabelText('기준 마커')).toHaveTextContent(base ?? '');
});

it('가게를 골라 지도가 그 가게로 옮겨 가도 기준은 그대로이고 다시 찾지 않는다', async () => {
  const user = setup('/cheap-meals/restaurant');
  await user.click(await screen.findByRole('button', { name: '업소 마커 테스트' }));
  const before = calls.stores.mock.calls.length;
  const base = screen.getByLabelText('기준 마커').textContent;
  await user.click(screen.getByRole('button', { name: '가게 자리 멈춤 테스트' }));
  await new Promise((resolve) => setTimeout(resolve, 600));
  expect(calls.stores).toHaveBeenCalledTimes(before);
  expect(screen.getByLabelText('기준 마커')).toHaveTextContent(base ?? '');
});

it('카테고리 탭을 키보드로 전환할 수 있다', async () => {
  const user = setup();
  tab('식당').focus();
  await user.keyboard('{End}');
  expect(tab('배달')).toHaveAttribute('aria-selected', 'true');
  expect(tab('배달')).toHaveFocus();
});

it('응답을 기다리는 동안 로딩을 보여주고 빈 필터 결과를 미수집과 구분한다', async () => {
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  server.use(
    http.get('http://localhost:8080/api/promotions', async () => {
      await pending;
      return success(promotion('EMART24', [products[0]]));
    }),
  );
  const user = setup('/cheap-meals/convenience');
  // 글자 없이 가운데에 Progress Circle(40)만 둔다.
  expect(await screen.findByRole('progressbar', { name: '행사상품을 불러오고 있어요' })).toBeInTheDocument();
  expect(screen.queryByText('행사상품을 불러오고 있어요')).not.toBeInTheDocument();
  complete();
  await screen.findByRole('list', { name: '행사상품 목록' });
  await user.click(screen.getByRole('radio', { name: '할인' }));
  expect(screen.getByText('이 행사 유형의 상품이 없어요')).toBeInTheDocument();
  expect(screen.queryByText('아직 행사정보를 수집하지 않았어요')).not.toBeInTheDocument();
});
it('Escape는 상세만 한 번 닫고 기존 카테고리와 초점을 보존한다', async () => {
  const user = setup('/');
  await user.click(screen.getByRole('link', { name: '저렴한 한 끼' }));
  await user.click(tab('배달'));
  const card = await screen.findByRole('button', { name: /배민 테스트피자 할인 상세/ });
  await user.click(card);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(tab('배달')).toHaveAttribute('aria-selected', 'true');
  expect(card).toHaveFocus();
});

it('위치 확인 중 다른 탭으로 떠났다가 돌아와도 위치 버튼을 다시 쓸 수 있다', async () => {
  const locate = vi.spyOn(mapLocation, 'requestCurrentMapLocation').mockImplementation(() => new Promise(() => {}));
  try {
    const user = setup('/cheap-meals/restaurant');
    await screen.findAllByText(/기타비요식업/);
    expect(locate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
    expect(screen.getByRole('button', { name: '내 현재 위치로 이동' })).toBeDisabled();
    await user.click(tab('편의점'));
    await user.click(tab('식당'));
    expect(screen.getByRole('button', { name: '내 현재 위치로 이동' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
    expect(locate).toHaveBeenCalledTimes(2);
  } finally {
    locate.mockRestore();
  }
});

it('기준 바꾸기 시트와 칩은 없고 기록 매물이 있어도 줄줄이 나열하지 않는다', async () => {
  useTwoSameNamedRecords();
  setup('/cheap-meals/restaurant');
  await screen.findByRole('list', { name: '가게 목록' });
  expect(screen.queryByRole('button', { name: /바꾸기/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText(/매물 기준$/)).not.toBeInTheDocument();
  expect(screen.queryByText('어느 동네를 둘러볼까요?')).not.toBeInTheDocument();
});

it('휴대폰 식당 탭은 기준을 바꾸는 검색창 없이 공용 현재 위치 버튼을 지도 위에 띄우고 위치 오류를 버튼 옆에 알린다', async () => {
  const locate = vi.spyOn(mapLocation, 'requestCurrentMapLocation').mockRejectedValueOnce(new Error('denied'));
  try {
    const user = setup('/cheap-meals/restaurant');
    await screen.findByRole('list', { name: '가게 목록' });
    const locateButton = screen.getByRole('button', { name: '내 현재 위치로 이동' });
    const overlay = locateButton.parentElement!.parentElement!;
    expect(within(overlay).queryByRole('button', { name: /바꾸기|주소 검색/ })).not.toBeInTheDocument();
    await user.click(locateButton);
    expect(within(locateButton.parentElement!).getByRole('alert')).toHaveTextContent('현재 위치를 확인하지 못했어요.');
  } finally {
    locate.mockRestore();
  }
});

it('명시적으로 요청한 현재 위치가 거부되면 안내하고 재요청 성공 시 해당 좌표를 조회한다', async () => {
  const locate = vi
    .spyOn(mapLocation, 'requestCurrentMapLocation')
    .mockRejectedValueOnce(new Error('denied'))
    .mockResolvedValueOnce({ latitude: 37.5665, longitude: 126.978 });
  try {
    const user = setup('/cheap-meals/restaurant');
    await screen.findByRole('list', { name: '가게 목록' });
    expect(locate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('위치 권한을 확인해 주세요');
    await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
    await waitFor(() => expect(calls.stores).toHaveBeenCalledWith('2000', '37.5665', '126.978'));
    expect(await screen.findByRole('status', { name: '현재 위치 기준으로 보고 있어요' })).toBeInTheDocument();
    expect(screen.getByLabelText('기준 마커')).toHaveTextContent('37.5665,126.978');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  } finally {
    locate.mockRestore();
  }
});

it('업소 마커로 원본 메뉴 가격과 비요식업 상세를 열고 뒤로가면 목록을 복원한다', async () => {
  const user = setup('/cheap-meals/restaurant');
  await screen.findByRole('list', { name: '가게 목록' });
  await user.click(screen.getByRole('button', { name: '업소 마커 테스트' }));
  expect(screen.getByRole('region', { name: '메뉴와 서비스 가격' })).toHaveTextContent('5,000~7,000');
  expect(screen.getByText('등록된 전화번호가 없어요')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));
  expect(screen.getByRole('list', { name: '가게 목록' })).toBeInTheDocument();
});

it('업소 조회 오류에서 재시도한 빈 결과를 오류나 샘플 업소로 대체하지 않는다', async () => {
  let failed = true;
  server.use(
    http.get('http://localhost:8080/api/maps/good-price-stores', () =>
      failed
        ? new HttpResponse(null, { status: 500 })
        : success({ center: { latitude: 37.5, longitude: 127 }, radius: 2000, count: 0, stores: [], dataAsOf: null }),
    ),
  );
  const user = setup('/cheap-meals/restaurant');
  expect(await screen.findByRole('alert')).toHaveTextContent('가게 정보를 불러오지 못했어요');
  failed = false;
  await user.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('이 반경 안에 등록된 가게가 없어요')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '가게 목록' })).not.toBeInTheDocument();
});

it('세븐일레븐 UNKNOWN 상품을 상세까지 표시한다', async () => {
  const user = setup('/cheap-meals/convenience');
  await screen.findByRole('list', { name: '행사상품 목록' });
  await user.click(screen.getByRole('radio', { name: '세븐일레븐' }));
  await user.click(await screen.findByRole('button', { name: '행사상품 0 상세 보기' }));
  const sheet = within(screen.getByRole('dialog'));
  expect(sheet.getByText('세븐일레븐')).toBeInTheDocument();
  expect(sheet.getByText('카테고리 정보 없음')).toBeInTheDocument();
  await user.click(sheet.getByRole('button', { name: '상세 닫기' }));
});

it('수집 완료 0건은 미수집과 구별한다', async () => {
  server.use(http.get('http://localhost:8080/api/promotions', () => success(promotion('EMART24', []))));
  setup('/cheap-meals/convenience');
  expect(await screen.findByText('현재 등록된 행사상품이 없어요')).toBeInTheDocument();
  expect(screen.queryByText('아직 행사정보를 수집하지 않았어요')).not.toBeInTheDocument();
});

it('권한 오류 403에서 다른 상품이나 샘플 데이터를 보여주지 않는다', async () => {
  server.use(
    http.get('http://localhost:8080/api/promotions', () =>
      HttpResponse.json({ code: 'FORBIDDEN', message: '권한 없음', errors: [] }, { status: 403 }),
    ),
  );
  setup('/cheap-meals/convenience');
  expect(await screen.findByRole('alert')).toHaveTextContent('정보를 불러오지 못했어요');
  expect(screen.queryByRole('list', { name: '행사상품 목록' })).not.toBeInTheDocument();
});

it('만료된 401 응답은 기존 Refresh Token 클라이언트로 갱신하고 다시 조회한다', async () => {
  const refresh = vi.fn();
  server.use(
    http.get('http://localhost:8080/api/promotions', ({ request }) =>
      request.headers.get('Authorization') === 'Bearer refreshed-token'
        ? success(promotion('EMART24'))
        : HttpResponse.json({ code: 'UNAUTHORIZED', message: '만료', errors: [] }, { status: 401 }),
    ),
    http.post('http://localhost:8080/api/auth/refresh', () => {
      refresh();
      return success({ accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 60, member: { memberId: 1 } });
    }),
  );
  setup('/cheap-meals/convenience');
  expect(await screen.findByRole('list', { name: '행사상품 목록' })).toBeInTheDocument();
  expect(refresh).toHaveBeenCalledOnce();
});

it('같은 마커를 여러 번 선택해도 상세 닫기 한 번으로 목록으로 돌아간다', async () => {
  const user = setup('/cheap-meals/restaurant');
  await screen.findByRole('list', { name: '가게 목록' });
  await user.click(screen.getByRole('button', { name: '업소 마커 테스트' }));
  await user.click(screen.getByRole('button', { name: '업소 마커 테스트' }));
  await user.click(screen.getByRole('button', { name: '가게 상세 닫기' }));
  expect(screen.getByRole('list', { name: '가게 목록' })).toBeInTheDocument();
});

it('가게 상세를 연 채 기록 매물 마커를 누르면 그 매물이 기준이 되고 상세는 닫히며 뒤로가기는 이전 탭으로 간다', async () => {
  useTwoSameNamedRecords();
  const user = setup('/cheap-meals/delivery');
  await user.click(tab('식당'));
  await screen.findByRole('list', { name: '가게 목록' });
  await user.click(screen.getByRole('button', { name: '업소 마커 테스트' }));
  await user.click(await screen.findByRole('button', { name: '새 매물(서울 강남구 테헤란로 1) 기준으로 보기' }));
  expect(screen.getByLabelText('기준 마커')).toHaveTextContent('37.5,127.03');
  expect(screen.queryByRole('region', { name: '메뉴와 서비스 가격' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));
  expect(tab('배달')).toHaveAttribute('aria-selected', 'true');
});

it('현재 위치를 기다리는 동안 매물 마커로 기준을 고르면 늦게 온 현재 위치가 그 기준을 덮지 않는다', async () => {
  useTwoSameNamedRecords();
  let complete!: (coordinate: { latitude: number; longitude: number }) => void;
  const locate = vi.spyOn(mapLocation, 'requestCurrentMapLocation').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  try {
    const user = setup('/cheap-meals/restaurant');
    await screen.findByRole('list', { name: '가게 목록' });
    await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
    await user.click(await screen.findByRole('button', { name: '새 매물(서울 강남구 테헤란로 1) 기준으로 보기' }));
    await act(async () => complete({ latitude: 37.5665, longitude: 126.978 }));
    expect(screen.getByLabelText('기준 마커')).toHaveTextContent('37.5,127.03');
    expect(screen.getByRole('button', { name: '내 현재 위치로 이동' })).toBeEnabled();
  } finally {
    locate.mockRestore();
  }
});

it.each(['store=10', 'search=1'])(
  '상세 URL %s로 직접 진입해도 식당 목록을 유지한다(예전 search=1은 열지 않는다)',
  async (query) => {
    const user = setup(`/cheap-meals?tab=restaurant&${query}`);
    if (query.startsWith('store')) await user.click(await screen.findByRole('button', { name: '가게 상세 닫기' }));
    expect(tab('식당')).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('list', { name: '가게 목록' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

it('UT 퍼널 이벤트 네 개를 정해진 시점에 정해진 속성으로만 기록한다', async () => {
  const user = setup('/');
  await user.click(screen.getByRole('link', { name: '저렴한 한 끼' }));
  expect(trackEvent).toHaveBeenCalledTimes(1);
  expect(trackEvent).toHaveBeenCalledWith('cheap_meal_viewed', {});

  await user.click(tab('편의점'));
  expect(trackEvent).toHaveBeenLastCalledWith('cheap_meal_category_selected', {
    category: 'convenience',
    source: 'top_tab',
  });

  // 목록 응답과 필터 변경만으로는 상세 확인을 기록하지 않는다.
  await screen.findByRole('list', { name: '행사상품 목록' });
  await user.click(screen.getByRole('radio', { name: '1+1' }));
  expect(trackEvent).toHaveBeenCalledTimes(2);

  await user.click(screen.getByRole('button', { name: '행사상품 0 상세 보기' }));
  expect(trackEvent).toHaveBeenLastCalledWith('cheap_meal_detail_viewed', {
    category: 'convenience',
    provider: 'EMART24',
  });

  await user.click(within(screen.getByRole('dialog', { name: '상품 상세' })).getByRole('link', { name: /공식 행사/ }));
  expect(trackEvent).toHaveBeenLastCalledWith('cheap_meal_outbound_clicked', {
    category: 'convenience',
    destination: 'official_source',
    provider: 'EMART24',
  });
  expect(trackEvent).toHaveBeenCalledTimes(4);
});

it('주소로 복원한 탭은 카테고리 선택으로 세지 않고, 상단 탭과 가게 상세는 각각 기록한다', async () => {
  const user = setup('/cheap-meals/restaurant');
  await screen.findByRole('list', { name: '가게 목록' });
  expect(trackEvent).not.toHaveBeenCalledWith('cheap_meal_category_selected', expect.anything());

  await user.click(screen.getByRole('button', { name: '업소 마커 테스트' }));
  expect(trackEvent).toHaveBeenLastCalledWith('cheap_meal_detail_viewed', { category: 'restaurant' });
  await user.click(screen.getByRole('link', { name: /길찾기/ }));
  expect(trackEvent).toHaveBeenLastCalledWith('cheap_meal_outbound_clicked', {
    category: 'restaurant',
    destination: 'directions',
  });

  await user.click(tab('배달'));
  expect(trackEvent).toHaveBeenLastCalledWith('cheap_meal_category_selected', {
    category: 'delivery',
    source: 'top_tab',
  });
  await user.click(await screen.findByRole('button', { name: /배민 테스트피자 할인 상세/ }));
  expect(trackEvent).toHaveBeenLastCalledWith('cheap_meal_detail_viewed', { category: 'delivery', provider: 'BAEMIN' });
});

it('데스크탑은 공용 헤더 아래에서 가게 목록과 상세를 지도 옆에 함께 펼치고 상품 상세를 가운데 창으로 연다', async () => {
  const matchMedia = window.matchMedia;
  const setMatchMedia = (value: typeof window.matchMedia) =>
    Object.defineProperty(window, 'matchMedia', { configurable: true, value });
  setMatchMedia((query: string) => ({ ...matchMedia(query), matches: true }));
  // jsdom에는 scrollIntoView가 없어, 지도에서 고른 가게 카드로 스크롤하는 동작을 비워 둔다.
  Element.prototype.scrollIntoView = vi.fn();
  try {
    const user = setup('/cheap-meals/restaurant');
    expect(screen.getByRole('heading', { name: '저렴한 한 끼', level: 1 })).toBeInTheDocument();
    // 제목과 가로 탭은 왼쪽 리스트 칸 맨 위에 두고, 세 탭 모두 같은 자리다.
    expect(screen.getByRole('tablist', { name: '한 끼 카테고리' })).toHaveAttribute('aria-orientation', 'horizontal');
    await screen.findByRole('list', { name: '가게 목록' });

    await user.click(screen.getByRole('button', { name: '업소 마커 테스트' }));
    // 상세를 열어도 목록이 그대로 남는다.
    expect(screen.getByRole('list', { name: '가게 목록' })).toBeInTheDocument();

    await user.click(tab('편의점'));
    await user.click(await screen.findByRole('button', { name: '행사상품 0 상세 보기' }));
    const dialog = screen.getByRole('dialog', { name: '상품 상세' });
    await user.click(within(dialog).getByRole('button', { name: '상세 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    setMatchMedia(matchMedia);
  }
});
it('식당 탭을 처음 열어 보여 줄 목록이 없으면 늦추지 않고 그 자리에 Progress Circle을 바로 둔다', async () => {
  server.use(http.get('http://localhost:8080/api/maps/good-price-stores', () => new Promise<never>(() => {})));
  setup();
  // 지연 로딩(300ms)이 걸려 있으면 이 시간 안에는 문구가 나오지 않는다.
  expect(
    await screen.findByRole('progressbar', { name: '주변 가게를 찾고 있어요.' }, { timeout: 200 }),
  ).toBeInTheDocument();
});

it('휴대폰 상품 상세 시트와 가게 목록 시트는 끝까지 끌어 올리면 페이지로 열리고 네 단계를 오간다', async () => {
  const user = setup('/cheap-meals?tab=convenience');
  await user.click(await screen.findByRole('button', { name: '행사상품 0 상세 보기' }));
  const dialog = within(screen.getByRole('dialog', { name: '상품 상세' }));
  await expectSheetStages(user, dialog.getByRole('region', { name: '상품 상세' }));
  await user.click(screen.getByRole('button', { name: '브라우저 뒤로' }));

  await user.click(tab('식당'));
  await expectSheetStages(user, await screen.findByRole('region', { name: /착한가격 가게 \d+곳/ }));
});
