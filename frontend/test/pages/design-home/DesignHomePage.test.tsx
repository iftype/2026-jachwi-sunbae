import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import { getMockProperties, resetMockStore, setMockProperties } from '@/app/mocks/mockStore';
import DesignHomePage from '@/pages/design-home/DesignHomePage';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

beforeEach(() => {
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(...propertyHandlers);
});
afterEach(() => {
  resetAuthenticationForTests();
  resetMockStore();
});

const renderHome = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const target = (name: string) => <h1>{name}</h1>;
  render(
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<DesignHomePage />} />
            <Route path="/properties" element={target('본 방 기록 화면')} />
            <Route path="/checklists" element={target('체크리스트 화면')} />
            <Route path="/compare" element={target('방 비교 화면')} />
            <Route path="/map" element={target('지도 화면')} />
            <Route path="/neighborhoods" element={target('동네 찾기 화면')} />
            <Route path="/me" element={target('마이페이지 화면')} />
          </Routes>
        </MemoryRouter>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );
};

it('기능 카드, 빠른 메뉴 2개와 내 매물로 만든 최근 기록을 보여준다', async () => {
  renderHome();
  expect(screen.getByRole('link', { name: /매물 기록하기/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '최근 기록한 방' })).toBeInTheDocument();
  expect(await screen.findByText('신림역 원룸')).toBeInTheDocument();
  expect(screen.getByText('망원동 투룸')).toBeInTheDocument();
  const quickMenu = within(screen.getByRole('navigation', { name: '빠른 메뉴' }));
  expect(quickMenu.getAllByRole('link').map((link) => link.textContent)).toEqual(['체크리스트', '방 비교']);
  expect(screen.getByRole('img', { name: '자취선배' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '사용방법 알아보기' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '자취선배 홈 새로고침' })).toHaveAttribute('href', '/');
  expect(screen.getByText('계약 전, 놓친 문제는 없는지 확인해보세요.').tagName).toBe('P');
});

it.each([
  ['link', /매물 기록하기/, '본 방 기록 화면'],
  ['link', '체크리스트', '체크리스트 화면'],
  ['link', '방 비교', '방 비교 화면'],
  ['link', /인프라 보는 지도/, '지도 화면'],
  ['link', /동네 정보 찾기/, '동네 찾기 화면'],
  ['link', '마이페이지', '마이페이지 화면'],
] as const)('%s %s는 기존 앱 화면(%s)으로 이동한다', async (role, name, heading) => {
  const user = userEvent.setup();
  renderHome();
  await user.click(screen.getByRole(role, { name }));
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
});

it('최근 기록은 전체 보기 없이 최신 5개만 가로 레일로 보여준다', async () => {
  const [base] = getMockProperties();
  setMockProperties(Array.from({ length: 7 }, (_, index) => ({ ...base, id: 100 + index, name: `기록 ${index + 1}` })));
  renderHome();
  const rail = within(await screen.findByLabelText('최근 기록한 방 목록'));
  expect(rail.getAllByRole('link').map((link) => link.querySelector('strong')?.textContent)).toEqual([
    '기록 7',
    '기록 6',
    '기록 5',
    '기록 4',
    '기록 3',
  ]);
  expect(screen.queryByRole('link', { name: /전체 보기/ })).not.toBeInTheDocument();
});

it('최근 기록을 불러오지 못하면 안내와 다시 시도 버튼을 보여주고, 다시 시도하면 기록을 불러온다', async () => {
  const user = userEvent.setup();
  let failing = true;
  server.use(http.get('*/api/properties', () => (failing ? new HttpResponse(null, { status: 500 }) : undefined)));
  renderHome();
  const alert = within(await screen.findByRole('alert'));
  expect(alert.getByText('기록을 불러오지 못했어요.')).toBeInTheDocument();
  failing = false;
  await user.click(alert.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('신림역 원룸')).toBeInTheDocument();
});

it('푸터에 서비스 소개와 개인정보 안내 링크를 둔다', () => {
  renderHome();
  const footer = within(screen.getByRole('contentinfo'));
  expect(footer.getByRole('link', { name: '서비스 소개' })).toHaveAttribute('href', '/about');
  expect(footer.getByRole('link', { name: '개인정보·광고 측정 안내' })).toHaveAttribute('href', '/privacy');
  expect(footer.getByText('© 2026 자취선배')).toBeInTheDocument();
});
