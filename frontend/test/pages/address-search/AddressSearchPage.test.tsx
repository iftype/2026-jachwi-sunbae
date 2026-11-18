import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { expect, it } from 'vitest';

import { propertyPageFixture, propertySummaryFixture, successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import AddressSearchPage from '@/pages/address-search/AddressSearchPage';
import { setAuthentication } from '@/features/auth/model/authStore';
import { addRecentAddress } from '@/features/map/lib/recentAddressStore';
import { readSearchedAddress } from '@/features/map/lib/searchedAddressState';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

const recent = { address: null, roadAddress: '최근 검색 주소', jibunAddress: null, latitude: 37.5, longitude: 127 };
const Destination = () => {
  const { state, pathname } = useLocation();
  const navigate = useNavigate();
  const address = readSearchedAddress(state);
  return (
    <>
      <output aria-label="이동한 주소">{address?.roadAddress}</output>
      <output aria-label="돌아온 화면">{pathname}</output>
      <button onClick={() => navigate(-1)}>이전 화면</button>
    </>
  );
};
const show = (hasRecords = true, path = '/search') => {
  setAuthentication({ accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(
    http.get('*/api/properties', () =>
      HttpResponse.json(successEnvelope(propertyPageFixture(hasRecords ? [propertySummaryFixture] : []))),
    ),
  );
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <MemoryRouter initialEntries={path.includes('target=') ? ['/', path] : [path]}>
          <Routes>
            <Route path="/search" element={<AddressSearchPage />} />
            <Route path="/" element={<Destination />} />
            <Route path="/neighborhoods" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );
};

it('탭 없이 최근 검색과 내 기록을 순서대로 보여 주고 기록으로 이동한다', async () => {
  addRecentAddress(recent);
  show();
  await screen.findByRole('heading', { name: '내 기록' });
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
    '최근 검색',
    '내 기록',
  ]);
  expect(
    within(screen.getByRole('region', { name: '최근 검색' })).getByRole('button', { name: recent.roadAddress }),
  ).toBeInTheDocument();
  await userEvent.click(
    within(screen.getByRole('region', { name: '내 기록' })).getByRole('button', { name: /신림역 원룸/ }),
  );
  expect(await screen.findByLabelText('이동한 주소')).toHaveTextContent(propertySummaryFixture.location.address);
});

it('최근 검색을 모두 지워도 내 기록은 그대로 남는다', async () => {
  addRecentAddress(recent);
  show();
  await screen.findByRole('heading', { name: '내 기록' });
  await userEvent.click(screen.getByRole('button', { name: '전체 삭제' }));
  expect(screen.queryByRole('region', { name: '최근 검색' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '내 기록' })).toBeInTheDocument();
});

it('둘 다 비면 빈 안내 하나만 보여 준다', async () => {
  show(false);
  expect(
    await screen.findByText('최근 검색과 위치가 있는 기록이 아직 없어요. 주소를 찾아 보세요.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '최근 검색' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '내 기록' })).not.toBeInTheDocument();
});

it('내 기록이 없어도 최근 주소를 선택할 수 있다', async () => {
  addRecentAddress(recent);
  show(false);
  await userEvent.click(screen.getByRole('button', { name: recent.roadAddress }));
  expect(await screen.findByLabelText('이동한 주소')).toHaveTextContent(recent.roadAddress);
});

it('동네 찾기에서 열면 같은 최근 검색을 선택해 목적지로 돌려준다', async () => {
  addRecentAddress(recent);
  show(false, '/search?target=neighborhoods');
  await userEvent.click(screen.getByRole('button', { name: recent.roadAddress }));
  expect(await screen.findByLabelText('이동한 주소')).toHaveTextContent(recent.roadAddress);
});

it('출퇴근 장소 검색에서 뒤로 가면 기록 지도이고 주소를 고른 뒤에도 검색 화면을 다시 거치지 않는다', async () => {
  addRecentAddress(recent);
  show(false, '/search?target=neighborhoods');
  expect(screen.getByRole('textbox', { name: '출퇴근하는 장소 검색' })).toHaveAttribute(
    'placeholder',
    '주소로 지도 이동',
  );
  expect(screen.getByRole('button', { name: '지도에서 직접 고르기' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: recent.roadAddress }));
  expect(screen.getByLabelText('돌아온 화면')).toHaveTextContent('/neighborhoods');
  await userEvent.click(screen.getByRole('button', { name: '이전 화면' }));
  expect(screen.getByLabelText('돌아온 화면')).toHaveTextContent(/^\/$/);
});
it('첫 목적지 검색을 취소하면 원래 기록 지도로 돌아온다', async () => {
  show(false, '/search?target=neighborhoods');
  await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(screen.getByLabelText('돌아온 화면')).toHaveTextContent(/^\/$/);
});
