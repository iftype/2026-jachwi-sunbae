import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AppRoutes from '@/app/router/AppRoutes';
import type { WeatherPrototypeInitialState } from '@/features/weather/model/WeatherPrototypeProvider';
import WeatherPrototypeProvider from '@/features/weather/model/WeatherPrototypeProvider';
import WeatherSummaryCard from '@/features/weather/ui/weather-summary-card/WeatherSummaryCard';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

const renderMyPage = () =>
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' }}>
          <MemoryRouter initialEntries={['/me']}>
            <AppRoutes />
          </MemoryRouter>
        </PublicConfigProvider>
      </QueryClientProvider>
    </StrictMode>,
  );

const renderWeatherCard = (initialState: WeatherPrototypeInitialState) =>
  render(
    <WeatherPrototypeProvider initialState={initialState}>
      <WeatherSummaryCard />
    </WeatherPrototypeProvider>,
  );

describe('마이 화면', () => {
  it('생활 날씨·개인정보 처리방침·계정 삭제 요청만 두고, 알림을 켜고 끄면 날씨와 꺼짐 안내가 바뀐다', async () => {
    const user = userEvent.setup();
    renderMyPage();
    expect(await screen.findByText('생활 날씨 알림이 꺼져 있어요')).toBeInTheDocument();
    // 홈의 빠른 메뉴와 겹치는 기록 메뉴나 날씨 상세·설정으로 가는 길은 두지 않는다.
    expect(screen.queryByRole('navigation', { name: '내 기록' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '생활 날씨 알림 설정' })).not.toBeInTheDocument();
    expect(screen.queryByText(/프로토타입|샘플|시연/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /개인정보 처리방침/ })).toHaveAttribute('href', '/privacy');

    // 계정 삭제는 카드 → 확인 한 번으로 회원 번호가 채워진 메일을 연다.
    await user.click(screen.getByRole('button', { name: /계정 및 데이터 삭제 요청/ }));
    expect(screen.getByRole('dialog', { name: '계정 삭제를 요청할까요?' })).toHaveTextContent(/회원 번호 \d+/);
    await user.keyboard('{Escape}');

    const toggle = screen.getByRole('switch', { name: '알림 받기' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    // 권한은 OS가 직접 묻으므로 웹은 별도 안내 창이나 토스트를 띄우지 않는다.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('서울 시청')).toBeInTheDocument();
    expect(screen.getByText(/^\d{2}시 예보$/)).toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('생활 날씨 알림이 꺼져 있어요')).toBeInTheDocument();
  });
});

describe('생활 날씨 카드의 알림 받기', () => {
  it('기기 알림 권한이 거부되면 켜지지 않고 설정 열기를 안내한다', async () => {
    const user = userEvent.setup();
    renderWeatherCard({ notificationPermission: 'denied' });
    const toggle = screen.getByRole('switch', { name: '알림 받기' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('기기 알림이 꺼져 있어요.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '설정 열기' }));
    expect(screen.queryByText('기기 알림이 꺼져 있어요.')).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('위치 권한이 거부되면 켜지지 않고 설정 열기를 안내한다', async () => {
    const user = userEvent.setup();
    renderWeatherCard({ locationChoice: 'denied' });
    await user.click(screen.getByRole('switch', { name: '알림 받기' }));
    expect(screen.getByRole('switch', { name: '알림 받기' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('위치 권한이 꺼져 있어 알림을 보낼 수 없어요.')).toBeInTheDocument();
  });

  it('웹 브라우저에서는 토글을 막고 앱에서 받을 수 있다고 안내한다', () => {
    renderWeatherCard({ platform: 'web' });
    expect(screen.getByRole('switch', { name: '알림 받기' })).toBeDisabled();
    expect(screen.getByText('앱에서 알림을 받을 수 있어요.')).toBeInTheDocument();
  });

  it('현재 위치를 찾지 못하면 마지막 위치 기준임을 표시한다', async () => {
    const user = userEvent.setup();
    renderWeatherCard({ locationChoice: 'allowed', isLocationStale: true });
    await user.click(screen.getByRole('switch', { name: '알림 받기' }));
    expect(screen.getByText('마지막 위치 기준')).toBeInTheDocument();
  });

  it('알림을 켰지만 예보가 없으면 예보 준비 안내를 보인다', async () => {
    const user = userEvent.setup();
    renderWeatherCard({ scenario: 'empty' });
    await user.click(screen.getByRole('switch', { name: '알림 받기' }));
    expect(screen.getByText('아직 예보 정보가 없어요')).toBeInTheDocument();
  });
});
