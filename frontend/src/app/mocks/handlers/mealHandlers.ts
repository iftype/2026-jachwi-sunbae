import { http } from 'msw';

import { failure, now, success } from '../mockStore';

// 저렴한 한 끼(/cheap-meals) 세 탭의 목 응답이다. 식당은 기준 위치 옆에 착한가격업소 둘을 두고,
// 편의점과 배달은 짧은 목록을 준다. 상품 이미지는 바깥 출처를 부르지 않도록 비워 둔다(화면은 `이미지 없음`을 그린다).

const RADII = new Set([500, 1000, 2000]);

const goodPriceStores = (latitude: number, longitude: number) => [
  {
    id: 1,
    name: '선배네 김밥',
    businessType: '한식',
    phone: '02-000-0001',
    address: '서울 마포구 월드컵로 10길 20',
    latitude: latitude + 0.0012,
    longitude: longitude + 0.0008,
    distanceMeters: 150,
    menus: [
      { name: '김밥', price: '3,000원' },
      { name: '라면', price: '4,000원' },
    ],
  },
  {
    id: 2,
    name: '골목 칼국수',
    businessType: '한식',
    phone: null,
    address: '서울 마포구 월드컵로 12길 5',
    latitude: latitude - 0.002,
    longitude: longitude + 0.0015,
    distanceMeters: 260,
    menus: [{ name: '칼국수', price: '6,000원' }],
  },
];

const promotions = {
  EMART24: [
    { name: '참치마요 삼각김밥', price: 1500, imageUrl: '', category: 'MEAL', promotionType: 'ONE_PLUS_ONE' },
    { name: '바나나우유', price: 1800, imageUrl: '', category: 'BEVERAGE', promotionType: 'TWO_PLUS_ONE' },
  ],
  SEVEN_ELEVEN: [{ name: '제육 도시락', price: 4900, imageUrl: '', category: 'MEAL', promotionType: 'SALE' }],
} as const;

const deliveryOffers = [
  {
    id: 1,
    platform: 'BAEMIN',
    brandName: '선배 치킨',
    discountAmount: 3000,
    minOrderAmount: 18000,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    conditions: '첫 주문',
    lastVerifiedAt: now,
  },
  {
    id: 2,
    platform: 'COUPANG_EATS',
    brandName: '골목 떡볶이',
    discountAmount: 2000,
    minOrderAmount: null,
    startDate: null,
    endDate: null,
    conditions: null,
    lastVerifiedAt: now,
  },
];

export const mealHandlers = [
  http.get('*/api/maps/good-price-stores', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const latitude = Number(params.get('latitude'));
    const longitude = Number(params.get('longitude'));
    const radius = Number(params.get('radius'));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !RADII.has(radius)) {
      return failure('INVALID_REQUEST', 400);
    }
    const stores = goodPriceStores(latitude, longitude);
    return success({ center: { latitude, longitude }, radius, count: stores.length, dataAsOf: '2026-08', stores });
  }),
  http.get('*/api/promotions', ({ request }) => {
    const brand = new URL(request.url).searchParams.get('brand');
    if (brand !== 'EMART24' && brand !== 'SEVEN_ELEVEN') return failure('INVALID_REQUEST', 400);
    const products = promotions[brand];
    return success({
      brand,
      count: products.length,
      products,
      collectedAt: now,
      sourceUrl: 'https://example.com/promotions',
    });
  }),
  http.get('*/api/delivery-discount-offers', () => success(deliveryOffers)),
];
