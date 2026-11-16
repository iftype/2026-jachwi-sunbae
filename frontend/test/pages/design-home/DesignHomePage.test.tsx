import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

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
  vi.restoreAllMocks();
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
            <Route path="/compare" element={target('방 비교 화면')} />
            <Route path="/neighborhoods" element={target('동네 찾기 화면')} />
            <Route path="/me" element={target('마이페이지 화면')} />
          </Routes>
        </MemoryRouter>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );
};

it('휴대폰 홈에서 최근 기록과 비교, 전체 보기, 추가 링크를 보여 준다', async () => {
  renderHome();

  expect(screen.getByRole('heading', { name: '최근 기록한 방' })).toBeInTheDocument();
  expect(await screen.findByText('신림역 원룸')).toBeInTheDocument();
  expect(screen.getByText('망원동 투룸')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '방 비교 PDF 받기' })).toHaveAttribute('href', '/compare');
  expect(screen.getByRole('link', { name: '전체 기록 보기' })).toHaveAttribute('href', '/properties?view=list');
  expect(screen.getByRole('link', { name: '방 기록하기' })).toHaveAttribute('href', '/properties?view=map');
  expect(screen.getByRole('img', { name: '자취선배' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '자취선배 홈 새로고침' })).toHaveAttribute('href', '/');
});

it.each([
  ['방 비교 PDF 받기', '방 비교 화면'],
  ['전체 기록 보기', '본 방 기록 화면'],
  ['방 기록하기', '본 방 기록 화면'],
  [/^동네 찾기/, '동네 찾기 화면'],
  ['마이페이지', '마이페이지 화면'],
] as const)('%s는 기존 앱 화면(%s)으로 이동한다', async (name, heading) => {
  const user = userEvent.setup();
  renderHome();
  await user.click(await screen.findByRole('link', { name }));
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
});

it('최근 기록 영역에 방 7곳을 최신순으로 넣고 전체 수를 표시한다', async () => {
  const [base] = getMockProperties();
  setMockProperties(Array.from({ length: 7 }, (_, index) => ({ ...base, id: 100 + index, name: `기록 ${index + 1}` })));
  renderHome();

  const list = within(await screen.findByRole('region', { name: '최근 기록한 방 목록' }));
  expect(list.getAllByRole('link').map((link) => link.querySelector('strong')?.textContent)).toEqual([
    '기록 7',
    '기록 6',
    '기록 5',
    '기록 4',
    '기록 3',
    '기록 2',
    '기록 1',
  ]);
  expect(screen.getByText('총 7곳')).toBeInTheDocument();
});

it('기록이 없는 사용자는 지도에서 첫 방을 기록할 수 있다', async () => {
  setMockProperties([]);
  renderHome();

  expect(await screen.findByRole('link', { name: '첫 방 기록하기' })).toHaveAttribute('href', '/properties?view=map');
  expect(screen.queryByRole('link', { name: '방 비교 PDF 받기' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^동네 찾기/ })).toHaveAttribute('href', '/neighborhoods');
});

it('데스크탑 홈에서는 동네 찾기 다음에 PDF 바로가기를 표시한다', async () => {
  const matchMedia = window.matchMedia;
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...matchMedia(query),
    matches: query === '(min-width: 1024px)',
  }));
  renderHome();

  expect(await screen.findByRole('heading', { name: '내가 기록한 방' })).toBeInTheDocument();
  await screen.findByText('망원동 투룸');
  expect(screen.getByRole('link', { name: '전체 기록 보기' })).toHaveAttribute('href', '/properties?view=list');
  expect(screen.getByRole('link', { name: '방 기록하기' })).toHaveAttribute('href', '/properties?view=map');
  const tools = within(screen.getByRole('complementary', { name: '방 구하기 도구' }));
  expect(tools.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/neighborhoods', '/compare']);
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
  expect(footer.getByRole('link', { name: '자취선배 소개' })).toHaveAttribute('href', '/landing');
  expect(footer.queryByRole('link', { name: '사용 방법' })).not.toBeInTheDocument();
  expect(footer.getByRole('link', { name: '개인정보·광고 측정 안내' })).toHaveAttribute('href', '/privacy');
  expect(footer.getByText('© 2026 자취선배')).toBeInTheDocument();
});

it('최근 기록은 제목을 처음부터 보이고, 빠른 응답에는 안내 문구나 카드 뼈대 없이 바로 목록을 보여 준다', async () => {
  renderHome();
  const section = screen.getByRole('heading', { name: '최근 기록한 방' }).closest('section') as HTMLElement;
  // 몇 개가 올지 모르는 목록이라 카드 뼈대를 두지 않는다.
  expect(within(section).queryByRole('status')).not.toBeInTheDocument();
  expect(section.querySelector('[class*="skeleton"]')).toBeNull();
  // 데이터 전에도 문구 한 줄 높이는 잡아 둔다.
  expect(section.querySelector('[class*="RecentRooms-body"]')).not.toBeNull();
  expect(await within(section).findByText('신림역 원룸')).toBeInTheDocument();
  expect(within(section).queryByText('기록을 불러오는 중이에요.')).not.toBeInTheDocument();
});
