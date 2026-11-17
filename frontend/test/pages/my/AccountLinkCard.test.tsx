import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AppRoutes from '@/app/router/AppRoutes';
import AccountLinkCard from '@/pages/my/ui/account-link-card/AccountLinkCard';
import { getAuthenticationSnapshot } from '@/features/auth/model/authStore';
import { saveLinkedProvider, savePendingOAuth, takeStashedOAuthNotice } from '@/features/auth/model/oauthLink';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

const config = { apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' } as const;
const success = (data: unknown) => HttpResponse.json({ code: 'SUCCESS', message: '요청에 성공했습니다.', data });

const CurrentPath = () => <output aria-label="현재 경로">{useLocation().pathname}</output>;

const renderMyPage = (initialPath = '/me') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <PublicConfigProvider config={config}>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppRoutes />
          <CurrentPath />
        </MemoryRouter>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );

afterEach(() => {
  delete window.__JACHWI_NATIVE_APP__;
});

describe('마이 화면 계정 연결', () => {
  it('익명 회원에게 카카오와 Apple 로그인 버튼을 보여 준다', async () => {
    renderMyPage();

    expect(await screen.findByRole('heading', { name: '로그인하고 동기화하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '카카오 로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apple로 로그인' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
  });

  it('제공자 화면에서 완료 없이 돌아와 마이를 다시 보면 연결을 마치지 못했다고 알리고 회원은 그대로다', async () => {
    savePendingOAuth({ provider: 'KAKAO', previousMemberId: 1 });
    renderMyPage();

    expect(await screen.findByRole('status', { name: '계정 연결을 마치지 못했어요' })).toBeInTheDocument();
    expect(getAuthenticationSnapshot().session?.memberId).toBe(1);
    expect(screen.getByRole('heading', { name: '로그인하고 동기화하기' })).toBeInTheDocument();
  });

  it('연결한 회원에게는 연결한 계정 프로필 줄과 로그아웃만 보여 주고 다른 제공자 버튼은 숨긴다', async () => {
    saveLinkedProvider(1, 'APPLE');
    renderMyPage();

    expect(await screen.findByRole('heading', { name: 'Apple 계정으로 로그인됨' })).toBeInTheDocument();
    expect(screen.getByText('다른 기기에서도 기록을 이어서 봐요.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '로그인하고 동기화하기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '카카오 로그인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apple로 로그인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /바꾸기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  it('시작에 실패하면 지금 회원을 그대로 두고 실패를 안내한다', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/oauth/:provider/start', () =>
        HttpResponse.json({ code: 'OAUTH_PROVIDER_UNAVAILABLE', message: '장애', errors: [] }, { status: 503 }),
      ),
    );
    renderMyPage();

    await user.click(await screen.findByRole('button', { name: 'Apple로 로그인' }));

    expect(await screen.findByRole('status', { name: '지금은 계정을 연결할 수 없어요' })).toBeInTheDocument();
    expect(getAuthenticationSnapshot().session?.memberId).toBe(1);
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/me');
  });

  it('연결한 회원은 이 기기에서만 로그아웃하고 새 익명 회원으로 홈에 간다', async () => {
    const user = userEvent.setup();
    saveLinkedProvider(1, 'KAKAO');
    let hasCookie = true;
    server.use(
      http.post('*/api/auth/logout', () => {
        hasCookie = false;
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('*/api/auth/login', () =>
        success({
          accessToken: hasCookie ? 'linked-token' : 'anonymous-token',
          tokenType: 'Bearer',
          expiresIn: 900,
          member: { memberId: hasCookie ? 1 : 2 },
        }),
      ),
    );
    renderMyPage();

    expect(await screen.findByRole('heading', { name: '카카오 계정으로 로그인됨' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '카카오 로그인' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // 로그아웃 요청과 새 익명 로그인이 끝난 뒤에 홈으로 간다.
    await waitFor(() => expect(screen.getByLabelText('현재 경로')).toHaveTextContent(/^\/$/));
    expect(getAuthenticationSnapshot().session?.memberId).toBe(2);
  });

  it('앱 WebView에서는 계정 연결 카드와 버튼을 숨긴다', async () => {
    window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 2, features: ['push'] };
    saveLinkedProvider(1, 'KAKAO');
    renderMyPage();

    expect(await screen.findByRole('button', { name: /^회원 탈퇴/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /로그인하고 동기화하기|로그인됨/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '카카오 로그인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
  });

  it('앱 WebView에서 복귀 화면으로 들어오면 다시 로그인하지 않고 마이로 보낸다', async () => {
    window.__JACHWI_NATIVE_APP__ = { platform: 'android', version: 2 };
    let loginCalls = 0;
    server.use(
      http.post('*/api/auth/login', () => {
        loginCalls += 1;
        return success({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900, member: { memberId: 1 } });
      }),
    );
    renderMyPage('/oauth/complete');

    expect(await screen.findByRole('button', { name: /^회원 탈퇴/ })).toBeInTheDocument();
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/me');
    expect(screen.queryByRole('status', { name: /계정/ })).not.toBeInTheDocument();
    // 마이 화면의 자동 로그인 한 번뿐이다. 복귀 화면의 다시 로그인은 하지 않는다.
    expect(loginCalls).toBe(1);
  });

  it.each([
    ['cancelled', '계정 연결을 취소했어요'],
    ['unavailable', '지금은 계정을 연결할 수 없어요'],
  ])('콜백이 실패해 error=%s로 돌아오면 회원을 그대로 두고 마이에서 실패를 안내한다', async (error, title) => {
    savePendingOAuth({ provider: 'KAKAO', previousMemberId: 1 });
    renderMyPage(`/oauth/complete?error=${error}`);

    expect(await screen.findByRole('status', { name: title })).toBeInTheDocument();
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/me');
    expect(getAuthenticationSnapshot().session?.memberId).toBe(1);
    // 시작 정보를 썼으므로 마이가 '마치지 못했어요'를 한 번 더 띄우지 않는다.
    expect(screen.queryByRole('status', { name: '계정 연결을 마치지 못했어요' })).not.toBeInTheDocument();
  });

  it('auth만 알리고 키를 갖춘 제공자가 없는 앱에서는 숨긴다', async () => {
    window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 2, features: ['auth'], authProviders: [] };
    renderMyPage();

    expect(await screen.findByRole('button', { name: /^회원 탈퇴/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /로그인하고 동기화하기|로그인됨/ })).not.toBeInTheDocument();
  });

  describe('네이티브 로그인 브리지를 알린 앱', () => {
    const installApp = (reply: (nonce: string) => Record<string, unknown>) => {
      window.__JACHWI_NATIVE_APP__ = {
        platform: 'android',
        version: 2,
        features: ['push', 'auth'],
        authProviders: ['kakao'],
        appVersion: '2.2.0',
      };
      window.ReactNativeWebView = {
        postMessage: (raw: string) => {
          const { requestId, nonce } = JSON.parse(raw) as { requestId: string; nonce: string };
          queueMicrotask(() =>
            window.dispatchEvent(new CustomEvent('jachwi-auth', { detail: { requestId, ...reply(nonce) } })),
          );
        },
      };
    };

    afterEach(() => {
      delete window.ReactNativeWebView;
      vi.unstubAllGlobals();
    });

    it('앱이 알린 제공자만 보여 주고, 앱 로그인으로 이 화면에서 연결을 마친다', async () => {
      const user = userEvent.setup();
      installApp((nonce) => ({ status: 'success', provider: 'kakao', idToken: 'kakao-id-token', nonce }));
      const idTokenBodies: unknown[] = [];
      server.use(
        http.post('*/api/auth/oauth/:provider/nonce', () => success({ nonce: 'nonce-1' })),
        http.post('*/api/auth/oauth/:provider/id-token', async ({ request }) => {
          idTokenBodies.push(await request.json());
          return new HttpResponse(null, { status: 204 });
        }),
      );
      renderMyPage();

      expect(await screen.findByRole('heading', { name: '로그인하고 동기화하기' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Apple로 로그인' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '카카오 로그인' }));

      expect(await screen.findByRole('status', { name: '카카오 계정을 연결했어요' })).toBeInTheDocument();
      expect(idTokenBodies).toEqual([{ idToken: 'kakao-id-token', nonce: 'nonce-1' }]);
      expect(screen.getByRole('heading', { name: '카카오 계정으로 로그인됨' })).toBeInTheDocument();
      expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/me');
    });

    it('앱 로그인으로 이미 쓰던 회원으로 바뀌면 결과 안내를 남기고 페이지를 새로 연다', async () => {
      const user = userEvent.setup();
      installApp((nonce) => ({ status: 'success', provider: 'kakao', idToken: 'kakao-id-token', nonce }));
      let isLinked = false;
      server.use(
        http.post('*/api/auth/oauth/:provider/nonce', () => success({ nonce: 'nonce-1' })),
        http.post('*/api/auth/oauth/:provider/id-token', () => {
          isLinked = true;
          return new HttpResponse(null, { status: 204 });
        }),
        http.post('*/api/auth/login', () =>
          success({
            accessToken: 'token',
            tokenType: 'Bearer',
            expiresIn: 900,
            member: { memberId: isLinked ? 2 : 1 },
          }),
        ),
      );
      const reloadPage = vi.fn();
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
          <PublicConfigProvider config={config}>
            <MemoryRouter initialEntries={['/me']}>
              <AccountLinkCard memberId={1} reloadPage={reloadPage} />
            </MemoryRouter>
          </PublicConfigProvider>
        </QueryClientProvider>,
      );

      await user.click(await screen.findByRole('button', { name: '카카오 로그인' }));

      await waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1));
      expect(getAuthenticationSnapshot().session?.memberId).toBe(2);
      // 새로 연 화면이 읽을 안내가 남아 있다.
      expect(takeStashedOAuthNotice()?.tone).toBe('success');
    });

    it('새로 연 마이 화면은 남겨 둔 결과 안내를 한 번 보여 준다', async () => {
      installApp((nonce) => ({ status: 'success', provider: 'kakao', idToken: 't', nonce }));
      sessionStorage.setItem(
        'jachwi:oauth-notice',
        JSON.stringify({
          tone: 'success',
          title: '카카오 계정으로 기록을 합쳤어요',
          description: '합친 기록을 이어서 써요.',
        }),
      );
      renderMyPage();

      expect(await screen.findByRole('status', { name: '카카오 계정으로 기록을 합쳤어요' })).toBeInTheDocument();
      expect(sessionStorage.getItem('jachwi:oauth-notice')).toBeNull();
    });

    it('앱에서 취소하면 지금 회원을 그대로 두고 취소를 안내한다', async () => {
      const user = userEvent.setup();
      installApp(() => ({ status: 'cancelled', provider: 'kakao' }));
      server.use(http.post('*/api/auth/oauth/:provider/nonce', () => success({ nonce: 'nonce-1' })));
      renderMyPage();

      await user.click(await screen.findByRole('button', { name: '카카오 로그인' }));

      expect(await screen.findByRole('status', { name: '계정 연결을 취소했어요' })).toBeInTheDocument();
      expect(getAuthenticationSnapshot().session?.memberId).toBe(1);
      expect(screen.getByRole('heading', { name: '로그인하고 동기화하기' })).toBeInTheDocument();
    });

    it('서버에 API가 없으면 안내만 남기고 계정 연결 카드를 숨긴다', async () => {
      const user = userEvent.setup();
      installApp((nonce) => ({ status: 'success', provider: 'kakao', idToken: 't', nonce }));
      server.use(
        http.post('*/api/auth/oauth/:provider/nonce', () =>
          HttpResponse.json({ code: 'NOT_FOUND', message: '없음', errors: [] }, { status: 404 }),
        ),
      );
      renderMyPage();

      await user.click(await screen.findByRole('button', { name: '카카오 로그인' }));

      expect(await screen.findByRole('status', { name: '지금은 계정을 연결할 수 없어요' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /로그인하고 동기화하기|로그인됨/ })).not.toBeInTheDocument();
      expect(getAuthenticationSnapshot().session?.memberId).toBe(1);
    });
  });
});
