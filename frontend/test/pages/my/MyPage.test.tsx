import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMockWeatherForecast } from '@/app/mocks/handlers/weatherHandlers';
import AppRoutes from '@/app/router/AppRoutes';
import WeatherSummaryCard from '@/features/weather/ui/weather-summary-card/WeatherSummaryCard';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

const config = { apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' } as const;
const success = (data: unknown) => HttpResponse.json({ code: 'SUCCESS', message: '요청에 성공했습니다.', data });
const SEOUL = { latitude: 37.5665, longitude: 126.978 };

/** 서버 수신 동의를 기억하고, 위치 저장·수신 동의 변경 요청을 기록하는 날씨 API */
const useWeatherServer = ({
  enabled = false,
  failUpdate = false,
  forecast = createMockWeatherForecast('2026-10-26'),
}: { enabled?: boolean; failUpdate?: boolean; forecast?: unknown } = {}) => {
  const state = { enabled, savedLocations: [] as unknown[], updates: [] as boolean[] };
  server.use(
    http.get('*/api/members/me/weather-notification-settings', () => success({ enabled: state.enabled })),
    http.put('*/api/members/me/weather-notification-settings', async ({ request }) => {
      const body = (await request.json()) as { enabled: boolean };
      state.updates.push(body.enabled);
      if (failUpdate)
        return HttpResponse.json({ code: 'INTERNAL_ERROR', message: '실패', errors: [] }, { status: 500 });
      state.enabled = body.enabled;
      return success({ enabled: state.enabled });
    }),
    http.put('*/api/members/me/weather-location', async ({ request }) => {
      state.savedLocations.push(await request.json());
      return success({ available: true, gridX: 60, gridY: 127, updatedAt: '2026-10-26T00:00:00Z' });
    }),
    http.get('*/api/weather/forecasts', () => success(forecast)),
    http.get('*/api/maps/reverse-geocode', () =>
      success({ roadAddress: '서울 중구 세종대로 110', jibunAddress: '서울 중구 태평로1가 31', ...SEOUL }),
    ),
  );
  return state;
};

const originalGeolocation = navigator.geolocation;
const mockGeolocation = (result: 'allowed' | 'denied' | 'unavailable') => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (onSuccess: PositionCallback, onError: PositionErrorCallback) => {
        if (result === 'allowed') {
          onSuccess({ coords: { ...SEOUL, accuracy: 10 } } as GeolocationPosition);
          return;
        }
        onError({
          code: result === 'denied' ? 1 : 2,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      },
    },
  });
};

const renderMyPage = () =>
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <PublicConfigProvider config={config}>
          <MemoryRouter initialEntries={['/me']}>
            <AppRoutes />
          </MemoryRouter>
        </PublicConfigProvider>
      </QueryClientProvider>
    </StrictMode>,
  );

const renderWeatherCard = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
      }
    >
      <PublicConfigProvider config={config}>
        <WeatherSummaryCard />
      </PublicConfigProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 2 };
});

afterEach(() => {
  delete window.__JACHWI_NATIVE_APP__;
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation });
});

describe('마이 화면', () => {
  it('생활 날씨·개인정보 처리방침·계정 삭제 요청만 두고, 알림을 켜면 현재 위치를 저장하고 그 위치의 날씨를 보인다', async () => {
    const user = userEvent.setup();
    const weather = useWeatherServer();
    mockGeolocation('allowed');
    renderMyPage();
    expect(await screen.findByText('생활 날씨 알림이 꺼져 있어요')).toBeInTheDocument();
    // 홈의 빠른 메뉴와 겹치는 기록 메뉴나 날씨 상세·설정으로 가는 길은 두지 않는다.
    expect(screen.queryByRole('navigation', { name: '내 기록' })).not.toBeInTheDocument();
    expect(screen.queryByText(/프로토타입|샘플|시연/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /개인정보 처리방침/ })).toHaveAttribute('href', '/privacy');

    // 계정 삭제는 카드 → 확인 한 번으로 회원 번호가 채워진 메일을 연다.
    await user.click(screen.getByRole('button', { name: /계정 및 데이터 삭제 요청/ }));
    expect(screen.getByRole('dialog', { name: '계정 삭제를 요청할까요?' })).toHaveTextContent(/회원 번호 \d+/);
    await user.keyboard('{Escape}');

    const toggle = screen.getByRole('switch', { name: '알림 받기' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(weather.savedLocations).toEqual([SEOUL]);
    expect(weather.updates).toEqual([true]);
    // 권한은 OS가 직접 묻으므로 웹은 별도 안내 창이나 토스트를 띄우지 않는다.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText(/^\d{2}시 예보$/)).toBeInTheDocument();
    expect(await screen.findByText('중구 태평로1가')).toBeInTheDocument();

    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(weather.updates).toEqual([true, false]);
    expect(screen.getByText('생활 날씨 알림이 꺼져 있어요')).toBeInTheDocument();
  });
});

describe('생활 날씨 카드의 알림 받기', () => {
  it('알림을 켜 둔 채 열면 현재 위치를 다시 저장한다', async () => {
    const weather = useWeatherServer({ enabled: true });
    mockGeolocation('allowed');
    renderWeatherCard();
    expect(await screen.findByText(/^\d{2}시 예보$/)).toBeInTheDocument();
    expect(weather.savedLocations).toEqual([SEOUL]);
    expect(weather.updates).toEqual([]);
  });

  it('위치 권한을 거부하고 마지막 위치도 없으면 켜지 않고 이유를 알린다', async () => {
    const user = userEvent.setup();
    const weather = useWeatherServer();
    mockGeolocation('denied');
    renderWeatherCard();
    const toggle = await screen.findByRole('switch', { name: '알림 받기' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    expect(await screen.findByText('위치 권한을 허용해야 알림을 받을 수 있어요.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(weather.updates).toEqual([]);
  });

  it('현재 위치를 못 잡으면 마지막 위치로 켜고 마지막 위치 기준임을 표시한다', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('jachwi-weather-last-coordinate', JSON.stringify(SEOUL));
    const weather = useWeatherServer();
    mockGeolocation('unavailable');
    renderWeatherCard();
    const toggle = await screen.findByRole('switch', { name: '알림 받기' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(weather.updates).toEqual([true]);
    expect(screen.getByText('마지막 위치 기준')).toBeInTheDocument();
  });

  it('웹 브라우저에서는 알림은 앱에서 받을 수 있다고 안내한다', async () => {
    delete window.__JACHWI_NATIVE_APP__;
    useWeatherServer();
    renderWeatherCard();
    expect(await screen.findByText('알림은 앱에서 받을 수 있어요.')).toBeInTheDocument();
  });

  it('수신 동의 저장에 실패하면 꺼진 상태로 두고 다시 시도하라고 알린다', async () => {
    const user = userEvent.setup();
    useWeatherServer({ failUpdate: true });
    mockGeolocation('allowed');
    renderWeatherCard();
    const toggle = await screen.findByRole('switch', { name: '알림 받기' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    expect(await screen.findByText('알림 설정을 바꾸지 못했어요. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('알림이 켜져 있어도 예보가 없으면 예보 준비 안내를 보인다', async () => {
    const raw = createMockWeatherForecast('2026-10-26');
    useWeatherServer({
      enabled: true,
      forecast: { ...raw, hourly: raw.hourly.map((hour) => ({ ...hour, tmp: null })) },
    });
    mockGeolocation('allowed');
    renderWeatherCard();
    expect(await screen.findByText('아직 예보 정보가 없어요')).toBeInTheDocument();
  });
});
