import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { checklistHandlers } from '@/app/mocks/handlers/checklistHandlers';
import { createCommuteAreaHandlers } from '@/app/mocks/handlers/commuteAreaHandlers';
import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import { resetMockStore } from '@/app/mocks/mockStore';
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

const member = { id: 1 };

const successEnvelope = (data: unknown) => ({
  code: 'SUCCESS',
  message: '요청에 성공했습니다.',
  data,
});

const errorEnvelope = (code: string, message: string) => ({ code, message, errors: [] });

const RoutePath = () => {
  const { pathname, search } = useLocation();
  return (
    <>
      <span hidden data-testid="route-path">
        {pathname}
      </span>
      <span hidden data-testid="route-search">
        {search}
      </span>
    </>
  );
};
const renderRoutes = (path: string) => {
  server.use(
    http.get(`${config.apiBaseUrl}/api/properties`, () =>
      HttpResponse.json(
        successEnvelope({
          totalCount: 0,
          items: [],
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

const neighborhoodResponses = () =>
  server.use(
    ...mapHandlers,
    ...createCommuteAreaHandlers({ delayMs: 0 }),
    http.get('*/boundaries/manifest.json', () =>
      HttpResponse.json({ version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' }),
    ),
    http.get('*/boundaries/:filename', () => HttpResponse.json({ type: 'FeatureCollection', features: [] })),
  );
/** 지도의 한가운데를 눌러 출퇴근 장소로 고른다. */
const tapMap = () => {
  const map = screen.getByLabelText('데모 지도');
  vi.spyOn(map, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 500, 500));
  fireEvent.click(map, { clientX: 250, clientY: 250 });
};

describe('익명 자동 인증 흐름', () => {
  it('비인증 사용자도 동네 찾기 시안을 바텀탭 없이 볼 수 있다', async () => {
    renderRoutes('/neighborhoods');

    expect(await screen.findByRole('link', { name: '출퇴근 장소 검색' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });
  it.each([
    ['/explore/commute?mode=commute&utm_source=instagram', '/explore', '?utm_source=instagram'],
    ['/explore/price/prices/4113510100?mode=price', '/explore', ''],
    ['/neighborhoods/map?mode=price', '/neighborhoods', ''],
  ])('기준을 고르던 예전 동네 찾기 주소 %s는 통합 지도로 보낸다', async (path, pathname, search) => {
    renderRoutes(path);

    expect(
      await screen.findByRole(pathname === '/explore' ? 'textbox' : 'link', {
        name: pathname === '/explore' ? '출퇴근 장소' : '출퇴근 장소 검색',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent(pathname);
    expect(screen.getByTestId('route-search').textContent).toBe(search);
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

  it('처음 방문해도 로그인 입력 없이 자동 로그인하고 바로 홈을 연다', async () => {
    let loginCalls = 0;
    server.use(
      http.post(`${config.apiBaseUrl}/api/auth/login`, () => {
        loginCalls += 1;
        return HttpResponse.json(
          successEnvelope({
            accessToken: 'first-visit-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            newMember: true,
            member: { memberId: 1 },
          }),
        );
      }),
    );
    renderRoutes('/');

    expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent(/^\/$/);
    expect(getAccessToken()).toBe('first-visit-token');
    expect(loginCalls).toBe(1);
  });
  describe('자동 로그인을 기다리는 동안', () => {
    let releaseHeldLogin: (() => void) | undefined;
    afterEach(() => {
      releaseHeldLogin?.();
      releaseHeldLogin = undefined;
      resetMockStore();
    });

    /** 로그인 응답을 직접 풀어 줄 때까지 붙잡아 둔다. */
    const holdLogin = () => {
      let release: () => void = () => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      releaseHeldLogin = release;
      server.use(
        http.post(`${config.apiBaseUrl}/api/auth/login`, async () => {
          await released;
          return HttpResponse.json(
            successEnvelope({
              accessToken: 'held-token',
              tokenType: 'Bearer',
              expiresIn: 900,
              newMember: true,
              member: { memberId: 1 },
            }),
          );
        }),
      );
      return () => release();
    };

    /** 화면이 받을 기록과 체크리스트는 개발용 모의 서버로 채운다. `renderRoutes`의 빈 목록보다 나중에 등록해 앞선다. */
    const renderWithMockServer = (path: string) => {
      const view = renderRoutes(path);
      server.use(...propertyHandlers, ...checklistHandlers);
      return view;
    };

    it('홈은 로그인을 기다리는 동안에도 빈 화면이나 준비 문구 없이 바로 그린다', async () => {
      const release = holdLogin();
      renderWithMockServer('/');

      expect(await screen.findByRole('heading', { name: '본 방 기록' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('기록을 불러오는 중이에요.');
      expect(screen.queryByText('기록을 불러올 준비를 하고 있어요.')).not.toBeInTheDocument();

      release();

      expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
    });

    it('체크리스트는 로그인과 목록을 기다리는 동안 관리 화면과 목록 뼈대를 보여 준다', async () => {
      const release = holdLogin();
      renderWithMockServer('/checklists');

      // 화면 코드는 로그인을 기다리지 않고 받으므로, 로그인이 끝나기 전에 뼈대가 나온다.
      expect(await screen.findByRole('heading', { name: '체크리스트 관리' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('체크리스트를 불러오는 중이에요.');
      expect(screen.queryByText('기록을 불러올 준비를 하고 있어요.')).not.toBeInTheDocument();

      release();

      expect(await screen.findByRole('heading', { name: /사용자 체크리스트/ })).toBeInTheDocument();
      expect(screen.queryByText('체크리스트를 불러오는 중이에요.')).not.toBeInTheDocument();
    });

    it.each([
      ['/properties/10', '매물 상세를 불러오는 중이에요.'],
      ['/properties/10/edit', '매물 정보를 불러오는 중이에요.'],
      ['/properties/10/photos', '사진 정보를 불러오는 중이에요.'],
      ['/properties/10/memo', '부가 정보를 불러오는 중이에요.'],
      ['/properties/10/active-checklists/ON_SITE', '체크리스트를 불러오는 중이에요.'],
      ['/properties/10/checklists/51', '체크리스트를 불러오는 중이에요.'],
    ])('%s는 기다리는 동안 글자 로딩 대신 페이지 뼈대를 보여 준다', async (path, label) => {
      const release = holdLogin();
      renderWithMockServer(path);

      const status = await screen.findByRole('status');
      // 안내는 읽기 프로그램에만 알리고, 화면에는 뼈대만 둔다.
      expect(status).toHaveTextContent(label);
      expect(status.querySelector('.sr-only')).toHaveTextContent(label);
      expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(1);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

      release();
      await waitFor(() => expect(status).not.toBeInTheDocument());
    });

    it('마이는 회원 정보가 필요해 회원이 정해진 뒤 본문을 그린다', async () => {
      const release = holdLogin();
      renderRoutes('/me');

      expect(screen.queryByText('자취선배 (데모 지도)')).not.toBeInTheDocument();
      expect(screen.queryByText('기록을 불러올 준비를 하고 있어요.')).not.toBeInTheDocument();
      release();

      expect(await screen.findByText('자취선배 (데모 지도)')).toBeInTheDocument();
    });
  });

  it('자동 로그인이 실패하면 화면 대신 회원 정보 오류와 다시 시도를 보여 준다', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/api/auth/login`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_SERVER_ERROR', 'failed'), { status: 500 }),
      ),
    );

    renderRoutes('/');

    expect(await screen.findByText('회원 정보를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도하기' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '자취선배 주요 기능' })).not.toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it('랜딩은 로그인 없이 보고, 쿼리를 유지한 채 홈으로 잇는다', async () => {
    renderRoutes('/landing?utm_source=instagram');
    expect(await screen.findByRole('heading', { level: 1, name: /자취할 동네를 찾고/ })).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    // 첫 화면과 마지막 화면에 같은 바로가기를 둔다.
    const [webStart] = screen.getAllByRole('link', { name: '웹에서 바로 시작하기' });
    expect(webStart).toHaveAttribute('href', '/?utm_source=instagram');
    const [appStore] = screen.getAllByRole('link', { name: /App Store/ });
    expect(appStore).toHaveAttribute('href', expect.stringContaining('apps.apple.com'));
    const [googlePlay] = screen.getAllByRole('link', { name: /Google Play/ });
    expect(googlePlay).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=com.jachwisunbae');
  });
  it('사용 방법은 로그인 없이 보고 단계마다 실제 기능으로 이어진다', async () => {
    let loginCalls = 0;
    server.use(
      http.post(`${config.apiBaseUrl}/api/auth/login`, () => {
        loginCalls += 1;
        return HttpResponse.json(errorEnvelope('UNEXPECTED', 'unexpected'), { status: 500 });
      }),
    );
    renderRoutes('/guide');
    expect(await screen.findByRole('heading', { level: 1, name: '사용 방법' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '로그인 없이 바로 시작해요' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이렇게 사용해요' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '동네 찾아보기' })).toHaveAttribute('href', '/neighborhoods');
    expect(screen.getByRole('link', { name: '기록 지도에서 등록하기' })).toHaveAttribute('href', '/?view=map');
    expect(screen.getByRole('link', { name: '기록 지도 열기' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '체크리스트 보기' })).toHaveAttribute('href', '/checklists');
    expect(screen.getByRole('link', { name: '홈에서 시작하기' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: '앱으로 써보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /로그인하기/ })).not.toBeInTheDocument();
    expect(loginCalls).toBe(0);
  });
  it('예전 서비스 소개 주소는 사용 방법으로 이동한다', async () => {
    renderRoutes('/about');
    expect(await screen.findByRole('heading', { level: 1, name: '사용 방법' })).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent('/guide');
  });
  it('예전 매물 등록 주소는 등록 화면 대신 본 방 기록 지도로 보낸다', async () => {
    renderRoutes('/properties/new');
    await waitFor(() => expect(screen.getByTestId('route-path')).toHaveTextContent(/^\/$/));
    expect(screen.getByTestId('route-search').textContent).toBe('?view=map');
    expect(screen.queryByRole('region', { name: '매물 위치 선택' })).not.toBeInTheDocument();
  });
  it('예전 로그인 주소로 들어오면 자동 로그인 뒤 홈으로 이어진다', async () => {
    renderRoutes('/login');
    expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent(/^\/$/);
  });
  it('공개 탐색 뒤 기록하기를 눌러도 등록 폼이 아닌 홈으로 이동한다', async () => {
    startExploration('commute', true);
    completeExploration(3);
    prepareExplorationRecord({
      latitude: 37.4,
      longitude: 127.1,
      address: '테스트 동네',
      roadAddress: null,
      jibunAddress: null,
    });
    renderRoutes('/login');
    expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent(/^\/$/);
    expect(screen.queryByLabelText(/보증금 입력/)).not.toBeInTheDocument();
  });

  it('메모리에 유효한 토큰이 있으면 로그인 없이 현재 회원을 확인한다', async () => {
    setAuthentication({ accessToken: 'saved-in-memory', tokenType: 'Bearer', expiresIn: 60 });
    server.use(
      http.get(`${config.apiBaseUrl}/api/members/me`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer saved-in-memory');
        return HttpResponse.json(successEnvelope(member));
      }),
    );

    renderRoutes('/');

    expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
  });

  it('Refresh 쿠키로도 복원하지 못하면 새 회원 없이 안내와 다시 시도를 보여 준다', async () => {
    setAuthentication({ accessToken: 'expired-token', tokenType: 'Bearer', expiresIn: 60, memberId: 1 });
    server.use(
      http.get(`${config.apiBaseUrl}/api/members/me`, () =>
        HttpResponse.json(errorEnvelope('ACCESS_TOKEN_INVALID', 'expired'), { status: 401 }),
      ),
      http.post(`${config.apiBaseUrl}/api/auth/refresh`, () =>
        HttpResponse.json(errorEnvelope('REFRESH_TOKEN_INVALID', 'invalid'), { status: 401 }),
      ),
    );

    renderRoutes('/');

    expect(await screen.findByText('이전 기록을 이어서 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 기록으로 시작하기' })).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it('갱신이 거절된 뒤 새 기록으로 시작하기를 누르면 새 익명 회원으로 홈을 보여 준다', async () => {
    const user = userEvent.setup();
    setAuthentication({ accessToken: 'expired-token', tokenType: 'Bearer', expiresIn: 60, memberId: 1 });
    let meCalls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/members/me`, ({ request }) => {
        meCalls += 1;
        return request.headers.get('Authorization') === 'Bearer new-member-token'
          ? HttpResponse.json(successEnvelope({ id: 2 }))
          : HttpResponse.json(errorEnvelope('ACCESS_TOKEN_INVALID', 'expired'), { status: 401 });
      }),
      http.post(`${config.apiBaseUrl}/api/auth/refresh`, () =>
        HttpResponse.json(errorEnvelope('REFRESH_TOKEN_INVALID', 'invalid'), { status: 401 }),
      ),
      http.post(`${config.apiBaseUrl}/api/auth/login`, () =>
        HttpResponse.json(
          successEnvelope({
            accessToken: 'new-member-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            newMember: true,
            member: { memberId: 2 },
          }),
        ),
      ),
    );

    renderRoutes('/');
    await user.click(await screen.findByRole('button', { name: '새 기록으로 시작하기' }));

    expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
    expect(getAccessToken()).toBe('new-member-token');
    expect(meCalls).toBeGreaterThan(1);
  });

  it('현재 회원 조회 네트워크 실패는 재시도를 제공한다', async () => {
    setAuthentication({ accessToken: 'still-valid-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(http.get(`${config.apiBaseUrl}/api/members/me`, () => HttpResponse.error()));

    renderRoutes('/');

    expect(await screen.findByText('회원 정보를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도하기' })).toBeInTheDocument();
    expect(getAccessToken()).toBe('still-valid-token');
  });

  it('마이페이지는 로그아웃 없이 마이 화면을 보여 준다', async () => {
    const user = userEvent.setup();
    renderRoutes('/');

    await user.click(await screen.findByRole('link', { name: '마이페이지' }));

    expect(await screen.findByRole('heading', { name: '마이' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
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

it('데스크톱의 홈은 통합 지도로 이어지고 모드 URL을 바꿔도 같은 지도 DOM을 쓴다', async () => {
  const viewport = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(min-width: 1024px)',
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  }));
  try {
    setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
    neighborhoodResponses();
    renderRoutes('/');
    await screen.findByRole('region', { name: '본 방 기록 지도' });
    expect(screen.getByTestId('route-path')).toHaveTextContent('/');
    const map = document.querySelector('[data-shared-map]');
    expect(map).not.toBeNull();
    // 데스크탑은 왼쪽 네비 레일로 화면을 옮긴다.
    expect(
      within(screen.getByRole('navigation', { name: '화면 이동' })).getByRole('button', { name: '동네 찾기' }),
    ).toBeInTheDocument();
    // 레일의 `동네 찾기`는 검색 화면을 거치지 않고 같은 지도 위에서 왼쪽 조건 칸을 연다. 출퇴근 장소는 지도에서 고른다.
    await userEvent.click(
      within(screen.getByRole('navigation', { name: '화면 이동' })).getByRole('button', { name: '동네 찾기' }),
    );
    expect(await screen.findByRole('complementary', { name: '탐색 조건' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '지도에서 선택' }));
    tapMap();
    await userEvent.click(await screen.findByRole('button', { name: '이 조건으로 동네 찾기' }));
    expect(await screen.findByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
    expect(document.querySelector('[data-shared-map]')).toBe(map);
    // 데스크탑은 떠 있는 전환 버튼 없이 왼쪽 레일의 `내 기록`으로 기록 지도에 돌아간다.
    expect(screen.queryByRole('navigation', { name: '지도 모드' })).not.toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('navigation', { name: '화면 이동' })).getByRole('button', { name: '내 기록' }),
    );
    expect(await screen.findByRole('region', { name: '본 방 기록 지도' })).toBeInTheDocument();
    // 기록과 동네 찾기 결과는 같은 지도 DOM을 쓴다.
    expect(document.querySelector('[data-shared-map]')).toBe(map);
  } finally {
    viewport.mockRestore();
  }
});

it('모바일은 내 기록 목록의 안내 배너로 동네 찾기를 열고 찾은 뒤 헤더 타일로 같은 기록 지도에 복귀한다', async () => {
  neighborhoodResponses();
  renderRoutes('/?view=list');
  await userEvent.click(await screen.findByRole('button', { name: '10초만에 동네 찾기' }));
  // 처음에는 출퇴근 장소 검색 화면을 거치지 않고 동네 찾기 지도로 바로 가고, 지도 위 검색 칸에서 장소를 고른다.
  await pickDestination(0);
  const back = screen.getByRole('button', { name: '기록으로 전환' });
  expect(back.closest('header')).not.toBeNull();
  expect(screen.queryByRole('navigation', { name: '지도 모드' })).not.toBeInTheDocument();
  await userEvent.click(back);
  await screen.findByRole('region', { name: '본 방 기록 지도' });
});

it('동네 찾기의 원형 검색은 공용 검색 페이지에서 고른 주소로 바로 분석한다', async () => {
  server.use(
    ...mapHandlers,
    ...createCommuteAreaHandlers({ delayMs: 0 }),
    http.get('*/boundaries/manifest.json', () =>
      HttpResponse.json({ version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' }),
    ),
    http.get('*/boundaries/:filename', () => HttpResponse.json({ type: 'FeatureCollection', features: [] })),
  );
  renderRoutes('/neighborhoods');
  await userEvent.click(await screen.findByRole('link', { name: '출퇴근 장소 검색' }));
  expect(screen.getByTestId('route-path')).toHaveTextContent('/search');
  expect(screen.getByTestId('route-search')).toHaveTextContent('target=neighborhoods');
  await userEvent.type(await screen.findByRole('textbox', { name: '출퇴근하는 장소 검색' }), '신림');
  const result = await screen.findByRole('list', { name: '주소 검색 결과' });
  await userEvent.click(within(result).getAllByRole('button')[0]);
  expect(await screen.findByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /에서 찾기$/ })).not.toBeInTheDocument();
  expect(screen.getByTestId('route-path')).toHaveTextContent(/^\/neighborhoods$/);
  await userEvent.click(screen.getByRole('button', { name: '기록으로 전환' }));
  await screen.findByRole('region', { name: '본 방 기록 지도' });
});

const commuteSearchResponses = () =>
  server.use(
    ...mapHandlers,
    ...createCommuteAreaHandlers({ delayMs: 0 }),
    http.get('*/boundaries/manifest.json', () =>
      HttpResponse.json({ version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' }),
    ),
    http.get('*/boundaries/:filename', () => HttpResponse.json({ type: 'FeatureCollection', features: [] })),
  );
/** 통근 결과 요청 주소를 모은다. 끝나면 `stop`으로 듣기를 멈춘다. */
const trackCommuteRequests = () => {
  const urls: URL[] = [];
  const track = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/commute-areas/with-rents') urls.push(url);
  };
  server.events.on('request:start', track);
  return { urls, stop: () => server.events.removeListener('request:start', track) };
};
/** 출퇴근 장소 검색 화면에서 주소를 찾아 고른다. */
const searchDestination = async (index: number) => {
  await userEvent.type(await screen.findByRole('textbox', { name: '출퇴근하는 장소 검색' }), '신림');
  const result = await screen.findByRole('list', { name: '주소 검색 결과' });
  await userEvent.click(within(result).getAllByRole('button')[index]);
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
};
const pickDestination = async (index: number) => {
  await userEvent.click(await screen.findByRole('link', { name: '출퇴근 장소 검색' }));
  await searchDestination(index);
};

it('기록 지도에 다녀와 동네 찾기 타일을 눌러도 지난 결과로 돌아가고 통근 결과를 다시 요청하지 않는다', async () => {
  commuteSearchResponses();
  const requests = trackCommuteRequests();
  try {
    renderRoutes('/neighborhoods');
    await pickDestination(0);
    await waitFor(() => expect(requests.urls).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: '기록으로 전환' }));
    await screen.findByRole('region', { name: '본 방 기록 지도' });
    await userEvent.click(screen.getByRole('button', { name: '동네 찾기로 전환' }));
    expect(await screen.findByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent(/^\/neighborhoods$/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests.urls).toHaveLength(1);
  } finally {
    requests.stop();
  }
});

it('결과를 본 뒤 출퇴근 장소를 다른 곳으로 고르면 새 좌표로 통근 결과를 다시 요청한다', async () => {
  commuteSearchResponses();
  const places = [
    {
      address: '서울 관악구 신림로 1',
      roadAddress: '서울 관악구 신림로 1',
      jibunAddress: null,
      latitude: 37.4842,
      longitude: 126.9297,
    },
    {
      address: '서울 강남구 테헤란로 1',
      roadAddress: '서울 강남구 테헤란로 1',
      jibunAddress: null,
      latitude: 37.4981,
      longitude: 127.0276,
    },
  ];
  const twoPlaces = () => HttpResponse.json({ code: 'SUCCESS', message: '성공', data: places });
  server.use(http.get('*/api/maps/geocode', twoPlaces), http.get('*/api/maps/search', twoPlaces));
  const requests = trackCommuteRequests();
  try {
    renderRoutes('/neighborhoods');
    await pickDestination(0);
    await waitFor(() => expect(requests.urls).toHaveLength(1));
    await pickDestination(1);
    await waitFor(() => expect(requests.urls).toHaveLength(2));
    const [first, second] = requests.urls.map((url) => [
      url.searchParams.get('latitude'),
      url.searchParams.get('longitude'),
    ]);
    expect(second).not.toEqual(first);
  } finally {
    requests.stop();
  }
});

it('예시 매물의 체크리스트 교체 주소는 서버 요청 대신 안내와 상세 복귀를 제공한다', async () => {
  const requests: string[] = [];
  const track = ({ request }: { request: Request }) => {
    if (new URL(request.url).pathname.startsWith('/api/properties/-1')) requests.push(request.url);
  };
  server.events.on('request:start', track);
  try {
    renderRoutes('/properties/-1/active-checklists/ON_SITE?mode=replace');
    expect(await screen.findByText('미리보기 체크리스트는 교체할 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '매물 상세로 돌아가기' })).toHaveAttribute(
      'href',
      '/properties/-1?tab=checklist',
    );
    expect(requests).toEqual([]);
  } finally {
    server.events.removeListener('request:start', track);
  }
});
