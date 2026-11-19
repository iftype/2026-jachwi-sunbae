import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockWeatherForecast } from '@/app/mocks/handlers/weatherHandlers';
import AppRoutes from '@/app/router/AppRoutes';
import { getAuthenticationSnapshot, setAuthentication } from '@/features/auth/model/authStore';
import { WEATHER_LOCATION_DEADLINE_MS } from '@/features/weather/lib/weatherLocation';
import WeatherSummaryCard from '@/features/weather/ui/weather-summary-card/WeatherSummaryCard';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { installNativePush } from '../../helpers/nativePush';
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
  const state = { enabled, savedLocations: [] as unknown[], updates: [] as boolean[], testPushes: 0 };
  server.use(
    http.get('*/api/members/me/notification-settings', () => success({ enabled: state.enabled })),
    http.put('*/api/members/me/notification-devices/current', async ({ request }) => {
      const body = (await request.json()) as { installationId: string };
      return success({ installationId: body.installationId });
    }),
    http.delete('*/api/members/me/notification-devices/current', () => new HttpResponse(null, { status: 204 })),
    http.put('*/api/members/me/notification-settings', async ({ request }) => {
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
    http.post('*/api/members/me/weather-notifications/test', () => {
      state.testPushes += 1;
      return success({ sent: true });
    }),
    http.get('*/api/weather/forecasts', () => success(forecast)),
    http.get('*/api/maps/reverse-geocode', () =>
      success({ roadAddress: '서울 중구 세종대로 110', jibunAddress: '서울 중구 태평로1가 31', ...SEOUL }),
    ),
  );
  return state;
};

const originalGeolocation = navigator.geolocation;
/** silent: iOS가 위치를 잠깐 못 잡을 때(kCLErrorLocationUnknown)처럼 성공도 실패도 알리지 않는다. */
const mockGeolocation = (result: 'allowed' | 'denied' | 'unavailable' | 'silent') => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (onSuccess: PositionCallback, onError: PositionErrorCallback) => {
        if (result === 'silent') return;
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

const CurrentPath = () => <output aria-label="현재 경로">{useLocation().pathname}</output>;

const renderMyPage = () =>
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <PublicConfigProvider config={config}>
          <MemoryRouter initialEntries={['/me']}>
            <AppRoutes />
            <CurrentPath />
          </MemoryRouter>
        </PublicConfigProvider>
      </QueryClientProvider>
    </StrictMode>,
  );

const renderWeatherCard = (cardConfig: PublicConfig = config) => {
  // 실제 화면은 ProtectedRoute에서 인증을 마친 뒤 카드를 렌더링한다.
  setAuthentication({ accessToken: 'fake-weather-member', tokenType: 'Bearer', memberId: 1, expiresIn: 900 });
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
      }
    >
      <PublicConfigProvider config={cardConfig}>
        <WeatherSummaryCard />
      </PublicConfigProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  installNativePush();
});

afterEach(() => {
  delete window.__JACHWI_NATIVE_APP__;
  delete window.ReactNativeWebView;
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation });
});

describe('마이 화면', () => {
  it('생활 날씨, 바로가기, 개인정보 처리방침, 회원 탈퇴를 두고, 알림을 켜면 현재 위치를 저장하고 그 위치의 날씨를 보인다', async () => {
    const user = userEvent.setup();
    const weather = useWeatherServer();
    mockGeolocation('allowed');
    renderMyPage();
    expect(await screen.findByText('알림이 꺼져 있어요')).toBeInTheDocument();
    // 홈의 빠른 메뉴와 겹치는 기록 메뉴나 날씨 상세·설정으로 가는 길은 두지 않는다.
    expect(screen.queryByRole('navigation', { name: '내 기록' })).not.toBeInTheDocument();
    expect(screen.queryByText(/프로토타입|샘플|시연/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /개인정보 처리방침/ })).toHaveAttribute('href', '/privacy');
    // 하단 탭과 왼쪽 레일이 없어졌으니 지도 밖 도구 화면은 마이의 바로가기 목록에서 연다. 지도 화면(내 기록, 동네 찾기)은 지도 머리의 모드 타일로 오간다.
    const shortcuts = within(screen.getByRole('navigation', { name: '바로가기' }));
    expect(shortcuts.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['체크리스트', '/checklists'],
      ['방 비교', '/compare'],
      ['저렴한 한 끼', '/cheap-meals'],
      ['사용방법', '/guide'],
    ]);
    expect(screen.queryByText('기록 PDF 받기')).not.toBeInTheDocument();

    // 마이에는 회원 탈퇴를 두고, 기록을 바로 지우는 삭제 요청은 개인정보 처리방침의 삭제 요청 안내에서 받는다.
    expect(screen.getByRole('button', { name: '회원 탈퇴' })).toBeInTheDocument();
    expect(screen.queryByText(/지우려면/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /메일/ })).not.toBeInTheDocument();

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
    expect(screen.getByText('알림이 꺼져 있어요')).toBeInTheDocument();
  });
});

describe('마이 화면의 회원 탈퇴', () => {
  /** 탈퇴 요청 수를 세고, 성공하면 이어지는 로그인에서 2번 새 회원을 돌려주는 인증 API */
  const useResetServer = (result: 'success' | 'failure') => {
    const state = { resetCalls: 0, isDeleted: false };
    server.use(
      http.delete('*/api/members/me', () => {
        state.resetCalls += 1;
        if (result === 'failure') {
          return HttpResponse.json({ code: 'INTERNAL_ERROR', message: '실패', errors: [] }, { status: 500 });
        }
        state.isDeleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      // 탈퇴로 Refresh 쿠키가 만료된 뒤의 로그인만 새 회원을 만든다.
      http.post('*/api/auth/login', () =>
        success({
          accessToken: state.isDeleted ? 'reset-member-token' : 'test-auto-login-token',
          tokenType: 'Bearer',
          expiresIn: 900,
          newMember: state.isDeleted,
          member: { memberId: state.isDeleted ? 2 : 1 },
        }),
      ),
    );
    return state;
  };

  const openResetDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: /^회원 탈퇴/ }));
    const dialog = screen.getByRole('dialog', { name: '탈퇴할까요?' });
    expect(dialog).toHaveTextContent('삭제한 기록은 다시 볼 수 없고, 90일 뒤 완전히 파기돼요.');
    expect(dialog).toHaveTextContent('연결한 카카오나 Apple 계정이 있으면 연결도 끊어요.');
    return dialog;
  };

  it('확인하면 새 회원으로 바꾸고 홈으로 간다', async () => {
    const user = userEvent.setup();
    useWeatherServer();
    const reset = useResetServer('success');
    renderMyPage();
    const dialog = await openResetDialog(user);

    await user.click(within(dialog).getByRole('button', { name: '탈퇴' }));

    await waitFor(() => expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent(/^\/$/));
    expect(reset.resetCalls).toBe(1);
    expect(getAuthenticationSnapshot().session).toMatchObject({ accessToken: 'reset-member-token', memberId: 2 });
  });

  it('실패하면 대화상자에 안내하고 지금 회원과 화면을 그대로 둔다', async () => {
    const user = userEvent.setup();
    useWeatherServer();
    const reset = useResetServer('failure');
    renderMyPage();
    const dialog = await openResetDialog(user);

    await user.click(within(dialog).getByRole('button', { name: '탈퇴' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '탈퇴하지 못했어요. 지금 계정과 기록은 그대로예요.',
    );
    expect(reset.resetCalls).toBe(1);
    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent('/me');
    expect(getAuthenticationSnapshot()).toMatchObject({ terminationReason: null, session: { memberId: 1 } });
  });

  it('취소하면 탈퇴 요청을 보내지 않는다', async () => {
    const user = userEvent.setup();
    useWeatherServer();
    const reset = useResetServer('success');
    renderMyPage();
    const dialog = await openResetDialog(user);

    await user.click(within(dialog).getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reset.resetCalls).toBe(0);
    expect(getAuthenticationSnapshot().session?.memberId).toBe(1);
    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent('/me');
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

  it('위치 권한을 거부하고 마지막 위치도 없어도 공통 알림은 켜고, 날씨용 위치 권한은 앱 설정에서 허용하게 한다', async () => {
    const user = userEvent.setup();
    const native = installNativePush();
    const weather = useWeatherServer();
    mockGeolocation('denied');
    renderWeatherCard();
    const toggle = await screen.findByRole('switch', { name: '알림 받기' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(weather.updates).toEqual([true]);
    expect(weather.savedLocations).toEqual([]);
    expect(native.actions).toContain('enable');
    expect(screen.getByText('날씨는 위치를 확인한 뒤 알려 드려요')).toBeInTheDocument();
    expect(screen.getByText('배달 할인 알림은 위치 없이도 받아요')).toBeInTheDocument();
    expect(screen.getByText('위치 권한이 꺼져 있어요. 아래 설정 열기에서 켜 주세요.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '설정 열기' }));
    await waitFor(() => expect(native.actions).toContain('settings'));
  });

  it('위치를 확인하지 못하고 마지막 위치도 없어도 공통 알림은 켜고, 다음에 다시 확인한다고 알린다', async () => {
    const user = userEvent.setup();
    const weather = useWeatherServer();
    mockGeolocation('unavailable');
    renderWeatherCard();
    const toggle = await screen.findByRole('switch', { name: '알림 받기' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(weather.updates).toEqual([true]);
    expect(weather.savedLocations).toEqual([]);
    expect(await screen.findByText('지금 위치를 확인하지 못했어요. 다음에 열 때 다시 확인할게요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '설정 열기' })).not.toBeInTheDocument();
  });

  it('위치가 계속 답하지 않으면 확인 중 표시를 두고, 기다림이 끝나면 위치 없이 공통 알림을 켜고 이유를 알린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      installNativePush();
      const weather = useWeatherServer();
      mockGeolocation('silent');
      renderWeatherCard();
      const toggle = await screen.findByRole('switch', { name: '알림 받기' });
      await waitFor(() => expect(toggle).toBeEnabled());
      await user.click(toggle);
      expect(await screen.findByRole('progressbar', { name: '현재 위치를 확인하고 있어요.' })).toBeInTheDocument();
      expect(toggle).toBeDisabled();

      await vi.advanceTimersByTimeAsync(WEATHER_LOCATION_DEADLINE_MS);
      await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
      expect(
        await screen.findByText('지금 위치를 확인하지 못했어요. 다음에 열 때 다시 확인할게요.'),
      ).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
      expect(weather.updates).toEqual([true]);
      expect(weather.savedLocations).toEqual([]);
      expect(screen.queryByRole('button', { name: '설정 열기' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('알림 받기 토글은 생활 날씨와 배달 할인 알림을 함께 받는다고 안내한다', async () => {
    useWeatherServer();
    renderWeatherCard();
    await screen.findByRole('switch', { name: '알림 받기' });
    expect(screen.getByText('생활 날씨·배달 할인')).toBeInTheDocument();
    expect(screen.queryByText('매일 오전 7시, 오후 10시')).not.toBeInTheDocument();
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

describe('생활 날씨 카드의 푸시 알림 테스트', () => {
  const devConfig: PublicConfig = { ...config, appEnvironment: 'development' };
  const originalVisibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

  afterEach(() => {
    if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  });

  it('dev 서버의 앱에서 알림이 켜져 있으면, 기다리다 홈 화면으로 나가는 순간 테스트 알림을 보낸다', async () => {
    const user = userEvent.setup();
    const weather = useWeatherServer({ enabled: true });
    mockGeolocation('allowed');
    renderWeatherCard(devConfig);

    await user.click(await screen.findByRole('button', { name: '푸시 알림 테스트' }));
    expect(screen.getByRole('button', { name: /초 뒤 보내요$/ })).toBeDisabled();
    expect(screen.getByText('지금 홈 화면으로 나가면 푸시 알림으로 받을 수 있어요.')).toBeInTheDocument();
    expect(weather.testPushes).toBe(0);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(await screen.findByText('테스트 알림을 보냈어요. 기기 알림을 확인해 주세요.')).toBeInTheDocument();
    expect(weather.testPushes).toBe(1);
  });

  it('운영 설정이나 알림이 꺼진 상태에서는 테스트 버튼을 보이지 않는다', async () => {
    useWeatherServer({ enabled: true });
    mockGeolocation('allowed');
    const { unmount } = renderWeatherCard();
    expect(await screen.findByText(/^\d{2}시 예보$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '푸시 알림 테스트' })).not.toBeInTheDocument();
    unmount();

    useWeatherServer();
    renderWeatherCard(devConfig);
    const toggle = await screen.findByRole('switch', { name: '알림 받기' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(screen.queryByRole('button', { name: '푸시 알림 테스트' })).not.toBeInTheDocument();
  });
});
