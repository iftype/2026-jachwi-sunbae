import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import PropertyAppLayout from '@/app/layouts/property-app-layout/PropertyAppLayout';

describe('모바일 앱 셸', () => {
  it('로그인 뒤 화면은 바텀탭 없이 홈으로 돌아가는 상단 바를 둔다', () => {
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

    expect(screen.getByRole('heading', { name: '체크리스트' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
  });

  it('동네 찾기 지도는 상단 바 없이 지도 하단 여백 정책을 사용한다', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/neighborhoods/map']}>
        <Routes>
          <Route element={<PropertyAppLayout />}>
            <Route path="/neighborhoods/map" element={<h1>동네 찾기</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-map-page="true"]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '홈으로 돌아가기' })).not.toBeInTheDocument();
  });
});
