import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  counts: { HOSPITAL: 1, SCHOOL: 0, CONVENIENCE: 1, AGENCY: 0 },
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

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;

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
            <LocationProbe />
          </PublicConfigProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
};

const originalGeolocation = navigator.geolocation;

describe('지도 주소', () => {
  beforeEach(() => {
    queryClient.clear();
    server.use(
      http.get(`${config.apiBaseUrl}/api/maps/bus-stops`, ({ request }) =>
        HttpResponse.json(
          successEnvelope({
            center: { latitude: property.latitude, longitude: property.longitude },
            radius: Number(new URL(request.url).searchParams.get('radius') ?? 500),
            count: 1,
            busStops: [
              {
                nodeId: 'stop-1',
                name: '신림역 정류장',
                latitude: property.latitude,
                longitude: property.longitude,
                distanceMeters: 100,
              },
            ],
          }),
        ),
      ),
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

  it.each([
    ['/map', '/properties'],
    ['/map/1', '/properties/1'],
  ])('예전 인프라 지도 주소 %s는 본 방 기록(%s)으로 보낸다', async (from, to) => {
    renderAuthenticated(from);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(to));
  });
});
