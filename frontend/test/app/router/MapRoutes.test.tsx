import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import AppRoutes from '@/app/router/AppRoutes';
import { setAuthentication } from '@/features/auth/model/authStore';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
  mapProviderMode: 'demo',
};

const progress = {
  totalCount: 0,
  completedCount: 0,
  goodCount: 0,
  cautionCount: 0,
  unconfirmedCount: 0,
  progressRate: 0,
};

const property = {
  id: 10,
  name: '신림역 원룸',
  depositAmount: 10_000_000,
  monthlyRentAmount: 550_000,
  discoverySource: '데모 지도',
  address: '서울 관악구 신림로 12길 3',
  latitude: 37.48412,
  longitude: 126.92912,
  availableMoveInDate: null,
  maintenanceFeeAmount: null,
  visitScheduledAt: null,
  roomOptions: [],
  utilityOptions: [],
  photoCount: 0,
  photos: [],
  representativePhoto: null,
  overallProgress: progress,
  createdAt: '2026-08-10T07:30:00Z',
  updatedAt: '2026-08-10T07:40:00Z',
};

/** 지도 API는 매물 API와 달리 도로명·지번 주소를 그대로 내려준다. */
const mapAddress = {
  roadAddress: '서울 관악구 신림로 12길 3',
  jibunAddress: '서울 관악구 신림동 1433-12',
  latitude: property.latitude,
  longitude: property.longitude,
};

const nearbyResult = (radius: number) => ({
  center: { latitude: property.latitude, longitude: property.longitude },
  radius,
  counts: { HOSPITAL: 1, TRANSPORT: 0, SCHOOL: 0, CONVENIENCE: 1, AGENCY: 0 },
  places: [
    {
      providerPlaceId: 'demo-hospital-1',
      name: '신림 안심의원',
      category: 'HOSPITAL',
      address: '서울 관악구 신림로 20',
      latitude: 37.485,
      longitude: 126.93,
      distanceMeters: 320,
    },
    {
      providerPlaceId: 'demo-convenience-1',
      name: '모카 편의점',
      category: 'CONVENIENCE',
      address: '서울 관악구 신림로 18',
      latitude: 37.4845,
      longitude: 126.9295,
      distanceMeters: 180,
    },
  ],
});

let visitNumber = 0;

const renderAuthenticated = (path: string) => {
  setAuthentication({ accessToken: 'demo-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(
    http.get(`${config.apiBaseUrl}/api/members/me`, () =>
      HttpResponse.json(successEnvelope({ id: 1, name: '이자취', passwordProtected: false })),
    ),
  );

  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: path, key: `map-route-visit-${++visitNumber}` }]}>
          <PublicConfigProvider config={config}>
            <AppRoutes />
          </PublicConfigProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
};

const originalGeolocation = navigator.geolocation;

describe('MVP2 지도 화면', () => {
  beforeEach(() => {
    queryClient.clear();
    server.use(
      http.get(`${config.apiBaseUrl}/api/maps/nearby`, ({ request }) =>
        HttpResponse.json(
          successEnvelope(nearbyResult(Number(new URL(request.url).searchParams.get('radius') ?? 500))),
        ),
      ),
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: property.latitude,
              longitude: property.longitude,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          }),
        ),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation });
  });

  it('현재 위치와 주변 매물 목록을 표시하고 매물 선택 시 상세로 이동한다', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope({ totalCount: 1, items: [property] })),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(property))),
    );

    renderAuthenticated('/map');

    expect(await screen.findByRole('generic', { name: '데모 지도' })).toBeInTheDocument();
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));

    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledOnce();
    expect(await screen.findByRole('img', { name: '현재 위치' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '내 현재 위치로 이동' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '현재 위치 확인' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '500m' })).toBeEnabled();

    // 상단 검색바 확인
    expect(screen.getByRole('button', { name: '주소 또는 위치 검색' })).toBeInTheDocument();

    // 하단 매물 카드 오버레이 확인 (PropertyCard 컴포넌트)
    expect(await screen.findByRole('region', { name: '지도 주변 매물 목록' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '지도 위 매물 목록 열기' }));
    expect(
      within(screen.getByRole('region', { name: '지도 주변 매물 목록' })).getByText('신림역 원룸'),
    ).toBeInTheDocument();
    expect(screen.getByText(/1,000만원 \/ 월세 55만원/)).toBeInTheDocument();
  });

  it('GPS 없이 매물 추가 중에도 반경과 시설 필터를 유지하고 취소하면 목록을 복원한다', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope({ totalCount: 0, items: [] })),
      ),
      http.get(`${config.apiBaseUrl}/api/maps/reverse-geocode`, () => HttpResponse.json(successEnvelope(mapAddress))),
    );
    renderAuthenticated('/map');
    await user.click(await screen.findByRole('button', { name: '지도에서 매물 추가' }));
    expect(screen.getByRole('button', { name: '500m' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1km' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2km' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /병원 표시하기/ }));
    expect(await screen.findByRole('button', { name: /병원 숨기기/ })).toHaveAttribute('aria-pressed', 'true');
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByRole('region', { name: '지도 주변 매물 목록' })).toBeInTheDocument();
  });

  it('위치 조회 안내는 하단 위치 이동 버튼 옆에 표시하고 상단 확인 버튼은 표시하지 않는다', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope({ totalCount: 0, items: [] })),
      ),
    );
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(() => undefined);
    renderAuthenticated('/map');
    const locationButton = await screen.findByRole('button', { name: '내 현재 위치로 이동' });
    await user.click(locationButton);
    expect(screen.queryByRole('button', { name: '현재 위치 확인' })).not.toBeInTheDocument();
    expect(within(locationButton.parentElement!).getByRole('status')).toHaveTextContent(
      '현재 위치를 확인하는 중이에요.',
    );
    expect(locationButton).toBeDisabled();
  });

  it('매물 마커 선택 후 반경을 바꿔도 저장 좌표를 유지하고 지도 빈 곳을 누르면 선택을 해제한다', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope({ totalCount: 1, items: [property] })),
      ),
      http.get(`${config.apiBaseUrl}/api/maps/nearby`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        return HttpResponse.json(successEnvelope(nearbyResult(Number(url.searchParams.get('radius')))));
      }),
    );
    renderAuthenticated('/map');
    await user.click(await screen.findByRole('button', { name: '내 현재 위치로 이동' }));
    await user.click(await screen.findByRole('button', { name: property.name }));
    await user.click(screen.getByRole('button', { name: '2km' }));
    await waitFor(() =>
      expect(
        requests.some(
          (url) =>
            url.searchParams.get('latitude') === String(property.latitude) &&
            url.searchParams.get('longitude') === String(property.longitude) &&
            url.searchParams.get('radius') === '2000',
        ),
      ).toBe(true),
    );
    expect(screen.queryByRole('combobox', { name: '주변 시설을 확인할 매물' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '선택한 매물 정보 닫기' })).not.toBeInTheDocument();
    expect(screen.queryByText('지도 위 매물')).not.toBeInTheDocument();
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('generic', { name: '데모 지도' }));
    expect(screen.getByRole('button', { name: '지도 위 매물 목록 열기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: property.name })).not.toBeInTheDocument();
  });

  it('등록한 매물이 없어도 지도 바텀시트를 열 수 있다', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope({ totalCount: 0, items: [] })),
      ),
    );

    renderAuthenticated('/map');

    const sheet = await screen.findByRole('region', { name: '지도 주변 매물 목록' });
    const trigger = within(sheet).getByRole('button', { name: '지도 위 매물 목록 열기' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);

    expect(await within(sheet).findByText('현재 지도 화면에 등록된 매물이 없어요.')).toBeVisible();

    expect(within(sheet).getByRole('button', { name: '지도 위 매물 목록 닫기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('매물 응답 전부터 손잡이를 표시하고 펼친 내부만 로딩 처리한다', async () => {
    const user = userEvent.setup();
    let resolveRequest!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, async () => {
        await pending;
        return HttpResponse.json(successEnvelope({ totalCount: 0, items: [] }));
      }),
    );
    renderAuthenticated('/map');
    const sheet = await screen.findByRole('region', { name: '지도 주변 매물 목록' });
    expect(within(sheet).queryByRole('status')).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: '지도 위 매물 목록 열기' }));
    expect(within(sheet).getByRole('status')).toHaveTextContent('매물을 불러오는 중이에요.');
    resolveRequest();
    expect(await within(sheet).findByText('현재 지도 화면에 등록된 매물이 없어요.')).toBeVisible();
  });

  it('주소 검색은 필요할 때 열고 도로명·지번 주소와 좌표를 위치 선택에 유지한다', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope({ totalCount: 0, items: [] })),
      ),
      http.get(`${config.apiBaseUrl}/api/maps/reverse-geocode`, () =>
        HttpResponse.json(
          successEnvelope({
            roadAddress: mapAddress.roadAddress,
            jibunAddress: mapAddress.jibunAddress,
            latitude: mapAddress.latitude,
            longitude: mapAddress.longitude,
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/maps/geocode`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('query')).toBe('신림');
        return HttpResponse.json(
          successEnvelope([
            {
              roadAddress: mapAddress.roadAddress,
              jibunAddress: mapAddress.jibunAddress,
              latitude: mapAddress.latitude,
              longitude: mapAddress.longitude,
            },
          ]),
        );
      }),
    );

    renderAuthenticated('/map/select-location');
    const openSearchButton = await screen.findByRole('button', { name: '주소 검색 열기' });
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: '주소 검색' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();

    await user.click(openSearchButton);
    await user.type(await screen.findByRole('textbox', { name: '주소 검색' }), '신림');
    await user.click(screen.getByRole('button', { name: '검색' }));

    const results = await screen.findByRole('list', { name: '주소 검색 결과' });
    expect(within(results).getByText(mapAddress.roadAddress)).toBeInTheDocument();
    expect(within(results).getByText(mapAddress.jibunAddress)).toBeInTheDocument();
    await user.click(within(results).getByRole('button'));
    expect(screen.getByRole('button', { name: '이 위치로 매물 등록하기' })).toBeEnabled();
  });

  it('초기 카테고리를 끄고 선택 카테고리만 모바일 스크롤 목록에 표시한다', async () => {
    const user = userEvent.setup();
    const requestedRadii: string[] = [];
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(property))),
      http.get(`${config.apiBaseUrl}/api/maps/nearby`, ({ request }) => {
        const radius = new URL(request.url).searchParams.get('radius') ?? '';
        requestedRadii.push(radius);
        return HttpResponse.json(successEnvelope(nearbyResult(Number(radius))));
      }),
    );

    renderAuthenticated('/properties/10/nearby');

    expect(await screen.findByRole('heading', { name: '신림역 원룸 매물 주변 2km' })).toBeInTheDocument();
    expect(screen.queryByText('신림역 원룸', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '주변 시설 목록' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '병원 표시하기, 1개' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(requestedRadii).toContain('2000'));

    await user.click(screen.getByRole('button', { name: '시설 목록 보기' }));
    expect(screen.getByText('위에서 확인할 시설을 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '스크롤 가능한 주변 시설 목록' })).toHaveAttribute('tabindex', '0');

    await user.click(screen.getByRole('button', { name: '병원 1개 표시하기' }));
    expect(await screen.findByRole('list', { name: '주변 시설 목록' })).toHaveTextContent('신림 안심의원');
    expect(screen.getByRole('list', { name: '주변 시설 목록' })).not.toHaveTextContent('모카 편의점');

    await user.click(screen.getByRole('button', { name: '편의점 1개 표시하기' }));
    await user.click(await screen.findByRole('button', { name: '모카 편의점' }));
    const placeDetail = await screen.findByRole('region', { name: '모카 편의점 시설 상세' });
    expect(placeDetail).toHaveTextContent('180m');
    expect(placeDetail).toHaveTextContent('서울 관악구 신림로 18');
    await user.click(within(placeDetail).getByRole('button', { name: '모카 편의점 상세 닫기' }));
    expect(screen.queryByRole('region', { name: '모카 편의점 시설 상세' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '500m' }));
    await waitFor(() => expect(requestedRadii).toContain('500'));

    await user.click(screen.getByRole('button', { name: '학교 표시하기, 0개' }));
    expect(screen.getByRole('button', { name: '학교 숨기기, 0개' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '병원 숨기기, 1개' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '전체' }));
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2km' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('link', { name: '매물 지도로 돌아가기' })).toHaveAttribute('href', '/map');
  });
});
