import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PropertyAppLayout from '@/app/layouts/property-app-layout/PropertyAppLayout';

describe('모바일 앱 셸', () => {
  it('로그인 뒤 화면은 바텀탭 없이 홈으로 돌아가는 상단 바를 둔다', () => {
    render(
      <MemoryRouter initialEntries={['/compare/history']}>
        <Routes>
          <Route element={<Outlet context={{ memberId: 1, displayName: '이자취', passwordProtected: false }} />}>
            <Route element={<PropertyAppLayout />}>
              <Route path="/compare/history" element={<h1>앱 화면</h1>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '앱 화면' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
  });

  it.each(['/neighborhoods', '/neighborhoods/areas/11230640'])(
    '동네 찾기 지도(%s)는 상단 바 없이 지도 하단 여백 정책을 사용한다',
    (path) => {
      const { container } = render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<PropertyAppLayout />}>
              <Route path="/neighborhoods/*" element={<h1>동네 찾기</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
      expect(container.querySelector('[data-map-page="true"]')).not.toBeNull();
      expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '홈으로 돌아가기' })).not.toBeInTheDocument();
    },
  );

  it.each([
    '/properties/10/photos',
    '/properties/10/memo',
    '/properties/10/edit',
    '/properties/10/nearby',
    '/neighborhoods/nearby',
  ])('자체 뒤로 가기가 있는 화면(%s)에는 홈으로 가는 상단 바를 겹쳐 두지 않는다', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<PropertyAppLayout />}>
            <Route path="/properties/:propertyId/*" element={<h1>매물 하위 화면</h1>} />
            <Route path="/neighborhoods/nearby" element={<h1>동네 주변 분석</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '홈으로 돌아가기' })).not.toBeInTheDocument();
  });
});

describe('데스크탑 앱 셸', () => {
  it('데스크톱 공용 헤더를 제거하고 지도와 마이 진입점을 둔다', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(min-width: 1024px)',
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    try {
      render(
        <MemoryRouter initialEntries={['/checklists']}>
          <Routes>
            <Route element={<Outlet context={{ memberId: 1, displayName: '이자취', passwordProtected: false }} />}>
              <Route element={<PropertyAppLayout />}>
                <Route path="/checklists" element={<h1>체크리스트</h1>} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByRole('navigation', { name: '화면 이동' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '마이' })).toHaveAttribute('href', '/me');
      expect(screen.getByRole('link', { name: '지도' })).toHaveAttribute('href', '/');
      expect(screen.queryByRole('link', { name: '홈으로 돌아가기' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '체크리스트' })).toBeInTheDocument();
    } finally {
      matchMedia.mockRestore();
    }
  });
});
