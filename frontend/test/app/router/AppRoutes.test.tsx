import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AppRoutes from '@/app/router/AppRoutes';
import { getAccessToken, setAuthentication } from '@/features/auth/model/authStore';
import {
  completeExploration,
  prepareExplorationRecord,
  startExploration,
} from '@/features/onboarding/lib/explorationJourney';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
  mapProviderMode: 'demo',
};

const member = {
  id: 1,
  name: '이자취',
  passwordProtected: false,
};

const successEnvelope = (data: unknown) => ({
  code: 'SUCCESS',
  message: '요청에 성공했습니다.',
  data,
});

const errorEnvelope = (code: string, message: string) => ({ code, message, errors: [] });

const RoutePath = () => (
  <span hidden data-testid="route-path">
    {useLocation().pathname}
  </span>
);
const renderRoutes = (path: string) => {
  server.use(
    http.get(`${config.apiBaseUrl}/api/properties`, () =>
      HttpResponse.json(
        successEnvelope({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
        }),
      ),
    ),
  );

  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <RoutePath />
          <PublicConfigProvider config={config}>
            <AppRoutes />
          </PublicConfigProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
};

describe('닉네임 인증 흐름', () => {
  it('비인증 사용자도 동네 찾기 시안을 바텀탭 없이 볼 수 있다', async () => {
    renderRoutes('/neighborhoods');

    expect(await screen.findByRole('heading', { name: '자취할 동네를 찾아보세요' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '이름 또는 닉네임' })).not.toBeInTheDocument();
  });
  it('비인증 사용자에게 닉네임과 선택 비밀번호 입력을 표시한다', () => {
    renderRoutes('/login');

    expect(screen.getByRole('img', { name: '자취선배' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '자취선배 시작하기' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '이름 또는 닉네임' })).toBeInTheDocument();

    expect(screen.getByLabelText(/비밀번호/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이름으로 시작하기' })).toBeInTheDocument();
    expect(screen.getByText(/같은 닉네임을 입력한 사람이 기록을 함께 조회하고 수정/)).toBeInTheDocument();
  });

  it('인증 없이 개인정보 처리방침과 PostHog 수집 안내를 확인한다', async () => {
    renderRoutes('/privacy');

    expect(await screen.findByRole('heading', { name: '자취선배는 필요한 정보만 처리합니다.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '처리하는 정보와 목적' })).toBeInTheDocument();
    expect(
      screen.getByText(/웹 서비스와 운영 iOS·Android 앱\(WebView\)에서는 웹 번들에 포함된 PostHog/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'conditionaltype@gmail.com' })).toBeInTheDocument();
    expect(screen.getByText(/PostHog 세션 녹화에서는 텍스트와 요소 속성을 마스킹합니다/)).toBeInTheDocument();
  });

  it('보호 경로에 비인증으로 접근하면 닉네임 시작 화면으로 이동한다', async () => {
    renderRoutes('/properties');

    expect(await screen.findByRole('button', { name: '이름으로 시작하기' })).toBeInTheDocument();
  });
  it.each(['/', '/landing'])('비로그인 첫 방문 %s는 시연이 바로 보이는 랜딩에서 탐색으로 이어진다', async (path) => {
    const user = userEvent.setup();
    renderRoutes(path);
    expect(await screen.findByRole('heading', { name: '자취선배' })).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent('/landing');
    expect(screen.getByText('자취할 동네를 찾고, 직접 본 방을 기록해요.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이렇게 사용해요' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '자취할 동네 찾기' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '본 방 기록하기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '개인정보 처리방침' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '앱과 웹으로 시작하기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '서비스 바로가기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '앱으로 써보기' })).not.toBeInTheDocument();
    expect(screen.queryByText(/이미 본 방을 기록하고 싶어요/)).not.toBeInTheDocument();
    expect(screen.queryByText('살 동네부터, 본 방의 기록까지.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이미 기록 중이라면 로그인하기' })).toHaveAttribute('href', '/login');
    await user.click(screen.getByRole('link', { name: '동네 찾아보기' }));
    expect(await screen.findByRole('heading', { name: '자취할 동네를 찾아보세요' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /거리로 찾기/ })).toHaveAttribute('href', '/explore/commute');
    expect(screen.getByRole('link', { name: /월세 평균가 보기/ })).toHaveAttribute('href', '/explore/price');
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '자취선배 첫 사용 안내' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '자취선배 소개' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사용 안내 다시 보기' })).not.toBeInTheDocument();
  });
  it('로그인한 사용자는 랜딩에 들어와도 홈으로 이동한다', async () => {
    setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(http.get(`${config.apiBaseUrl}/api/members/me`, () => HttpResponse.json(successEnvelope(member))));
    renderRoutes('/landing');
    expect(await screen.findByRole('region', { name: '자취선배 주요 기능' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '이렇게 사용해요' })).not.toBeInTheDocument();
  });
  it('소개는 로그인 없이 별도 주소에서 볼 수 있다', async () => {
    renderRoutes('/about');
    expect(await screen.findByRole('heading', { name: '자취선배' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이렇게 사용해요' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '동네 찾아보기' })).toHaveAttribute('href', '/explore');
  });
  it('랜딩에서 바로 로그인 화면으로 이동한다', async () => {
    const user = userEvent.setup();
    renderRoutes('/landing');
    await user.click(await screen.findByRole('link', { name: '이미 기록 중이라면 로그인하기' }));
    expect(await screen.findByRole('button', { name: '이름으로 시작하기' })).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent('/login');
  });
  it('공개 탐색 후 로그인해도 등록 폼이 아닌 홈으로 이동한다', async () => {
    const user = userEvent.setup();
    startExploration('commute', true);
    completeExploration(3);
    prepareExplorationRecord({
      latitude: 37.4,
      longitude: 127.1,
      address: '테스트 동네',
      roadAddress: null,
      jibunAddress: null,
    });
    server.use(
      http.post(`${config.apiBaseUrl}/api/auth/nickname`, () =>
        HttpResponse.json(
          successEnvelope({
            accessToken: 'test-explore',
            tokenType: 'Bearer',
            expiresIn: 3600,
            newMember: true,
            member: { memberId: 1, name: '로컬시안', passwordProtected: false },
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/members/me`, () => HttpResponse.json(successEnvelope(member))),
    );
    renderRoutes('/login');
    await user.type(screen.getByRole('textbox', { name: '이름 또는 닉네임' }), '로컬시안');
    await user.click(screen.getByRole('button', { name: '이름으로 시작하기' }));
    expect(await screen.findByRole('region', { name: '자취선배 주요 기능' })).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent(/^\/$/);
    expect(screen.queryByLabelText(/보증금 입력/)).not.toBeInTheDocument();
  });

  it('비밀번호 없이 닉네임으로 시작해 토큰을 저장하고 홈으로 이동한다', async () => {
    const user = userEvent.setup();
    let loginRequest: unknown;
    server.use(
      http.post(`${config.apiBaseUrl}/api/auth/nickname`, async ({ request }) => {
        loginRequest = await request.json();
        return HttpResponse.json(
          successEnvelope({
            accessToken: 'nickname-access-token',
            tokenType: 'Bearer',
            expiresIn: 43_200,
            member: { memberId: 1, name: '자취초보', passwordProtected: false },
          }),
        );
      }),
    );

    renderRoutes('/login');
    await user.type(screen.getByRole('textbox', { name: '이름 또는 닉네임' }), '자취초보');
    await user.click(screen.getByRole('button', { name: '이름으로 시작하기' }));

    expect(await screen.findByRole('region', { name: '자취선배 주요 기능' })).toBeInTheDocument();
    expect(loginRequest).toEqual({ nickname: '자취초보' });
    expect(getAccessToken()).toBe('nickname-access-token');
  });

  it('선택 비밀번호를 함께 전송하고 보호된 회원 응답을 받는다', async () => {
    const user = userEvent.setup();
    let loginRequest: unknown;
    server.use(
      http.post(`${config.apiBaseUrl}/api/auth/nickname`, async ({ request }) => {
        loginRequest = await request.json();
        return HttpResponse.json(
          successEnvelope({
            accessToken: 'protected-access-token',
            tokenType: 'Bearer',
            expiresIn: 43_200,
            member: { memberId: 2, name: '안전한방', passwordProtected: true },
          }),
        );
      }),
    );

    renderRoutes('/login');
    await user.type(screen.getByRole('textbox', { name: '이름 또는 닉네임' }), '안전한방');
    await user.type(screen.getByLabelText(/비밀번호/), 'room-safe-2026');
    await user.click(screen.getByRole('button', { name: '이름으로 시작하기' }));

    expect(await screen.findByRole('region', { name: '자취선배 주요 기능' })).toBeInTheDocument();
    expect(loginRequest).toEqual({ nickname: '안전한방', password: 'room-safe-2026' });
  });

  it('빈 닉네임과 짧은 선택 비밀번호를 클라이언트에서 막는다', async () => {
    const user = userEvent.setup();
    let loginCalls = 0;
    server.use(
      http.post(`${config.apiBaseUrl}/api/auth/nickname`, () => {
        loginCalls += 1;
        return HttpResponse.json(successEnvelope({}));
      }),
    );

    renderRoutes('/login');
    await user.click(screen.getByRole('button', { name: '이름으로 시작하기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('이름 또는 닉네임을 입력해 주세요.');

    await user.type(screen.getByRole('textbox', { name: '이름 또는 닉네임' }), '테스터');
    await user.type(screen.getByLabelText(/비밀번호/), '123');
    await user.click(screen.getByRole('button', { name: '이름으로 시작하기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('4자 이상');
    expect(loginCalls).toBe(0);
  });

  it.each([
    ['NICKNAME_AUTHENTICATION_FAILED', 401, '닉네임 또는 비밀번호가 맞지 않아요.'],
    ['NICKNAME_PASSWORD_UNEXPECTED', 409, '비밀번호를 비우고 다시 시작해 주세요.'],
    ['NICKNAME_AUTH_RATE_LIMITED', 429, '10분 뒤 다시 시도해 주세요.'],
  ])('%s 오류를 안전한 안내로 표시한다', async (code, status, message) => {
    const user = userEvent.setup();
    server.use(
      http.post(`${config.apiBaseUrl}/api/auth/nickname`, () =>
        HttpResponse.json(errorEnvelope(code, 'sensitive'), { status }),
      ),
    );

    renderRoutes('/login');
    await user.type(screen.getByRole('textbox', { name: '이름 또는 닉네임' }), '보호된닉네임');
    await user.type(screen.getByLabelText(/비밀번호/), 'wrong-password');
    await user.click(screen.getByRole('button', { name: '이름으로 시작하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('sensitive')).not.toBeInTheDocument();
  });

  it('저장된 유효 토큰으로 현재 회원을 확인한다', async () => {
    setAuthentication({ accessToken: 'saved-in-memory', tokenType: 'Bearer', expiresIn: 60 });
    server.use(
      http.get(`${config.apiBaseUrl}/api/members/me`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer saved-in-memory');
        return HttpResponse.json(successEnvelope(member));
      }),
    );

    renderRoutes('/');

    expect(await screen.findByRole('region', { name: '자취선배 주요 기능' })).toBeInTheDocument();
  });

  it('현재 회원 조회가 401이면 토큰을 지우고 시작 화면으로 이동한다', async () => {
    setAuthentication({ accessToken: 'expired-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(
      http.get(`${config.apiBaseUrl}/api/members/me`, () =>
        HttpResponse.json(errorEnvelope('ACCESS_TOKEN_EXPIRED', 'expired'), { status: 401 }),
      ),
    );

    renderRoutes('/');

    expect(await screen.findByRole('button', { name: '이름으로 시작하기' })).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    expect(screen.getByText(/인증을 확인하지 못해 로그아웃/)).toBeInTheDocument();
  });

  it('현재 회원 조회 네트워크 실패는 재시도를 제공한다', async () => {
    setAuthentication({ accessToken: 'still-valid-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(http.get(`${config.apiBaseUrl}/api/members/me`, () => HttpResponse.error()));

    renderRoutes('/');

    expect(await screen.findByText('회원 정보를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도하기' })).toBeInTheDocument();
    expect(getAccessToken()).toBe('still-valid-token');
  });

  it('로그아웃하면 인증 정보를 지우고 닉네임 시작 화면으로 이동한다', async () => {
    const user = userEvent.setup();
    setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(http.get(`${config.apiBaseUrl}/api/members/me`, () => HttpResponse.json(successEnvelope(member))));
    renderRoutes('/');

    await user.click(await screen.findByRole('link', { name: '마이페이지' }));
    await user.click(await screen.findByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('button', { name: '이름으로 시작하기' })).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it.each([
    ['/export', '기록 내보내기는 준비 중이에요'],
    ['/tips', '선배 팁은 준비 중이에요'],
  ])('%s는 공통 준비 중 안내를 표시한다', async (path, heading) => {
    setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(http.get(`${config.apiBaseUrl}/api/members/me`, () => HttpResponse.json(successEnvelope(member))));

    renderRoutes(path);

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  });

  it('알 수 없는 경로에 fallback을 표시한다', async () => {
    renderRoutes('/does-not-exist');
    expect(await screen.findByText('페이지를 찾을 수 없어요')).toBeInTheDocument();
  });
});
