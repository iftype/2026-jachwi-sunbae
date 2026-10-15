import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import PropertyAppLayout from '@/app/layouts/property-app-layout/PropertyAppLayout';

describe('모바일 앱 셸', () => {
  afterEach(() => {
    delete window.__JACHWI_NATIVE_APP__;
  });

  it('동네 찾기에서도 공통 하단탭과 지도 하단 여백 정책을 사용한다', () => {
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
    expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/properties');
    expect(screen.getByRole('link', { name: '지도' })).toHaveAttribute('href', '/map');
    expect(screen.getByRole('link', { name: '동네 찾기' })).toHaveAttribute('aria-current', 'page');
  });

  it('네이티브 동네 찾기는 웹 탭을 중복 표시하지 않는다', () => {
    window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 1, features: ['tab-bar', 'tab-bar-overlay'] };
    const { container } = render(
      <MemoryRouter initialEntries={['/neighborhoods/map']}>
        <Routes>
          <Route element={<PropertyAppLayout />}>
            <Route path="/neighborhoods/map" element={<h1>동네 찾기</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-map-page="true"][data-native-tab-overlay="true"]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });

  it('네이티브 탭을 쓰는 지도는 별도 하단 여백 정책을 적용하고 웹 탭을 중복 표시하지 않는다', () => {
    window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 1, features: ['tab-bar'] };
    const { container } = render(
      <MemoryRouter initialEntries={['/map']}>
        <Routes>
          <Route element={<PropertyAppLayout />}>
            <Route path="/map" element={<h1>지도</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-map-page="true"][data-native-tab-bar="true"]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });
  it('현재 화면과 주요 메뉴 다섯 개를 함께 표시한다', () => {
    render(
      <MemoryRouter initialEntries={['/properties']}>
        <Routes>
          <Route element={<Outlet context={{ memberId: 1, displayName: '이자취', passwordProtected: false }} />}>
            <Route element={<PropertyAppLayout />}>
              <Route path="/properties" element={<h1>매물 목록</h1>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '매물 목록' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '체크리스트' })).toHaveAttribute('href', '/checklists');
    expect(screen.getByRole('link', { name: '마이' })).toHaveAttribute('href', '/me');
    expect(screen.getByRole('link', { name: '동네 찾기' })).toHaveAttribute('href', '/neighborhoods');
  });

  it('새 앱의 겹치는 탭 배치를 구버전 앱과 구분한다', () => {
    window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 1, features: ['tab-bar', 'tab-bar-overlay'] };
    const { container } = render(
      <MemoryRouter initialEntries={['/map']}>
        <Routes>
          <Route element={<PropertyAppLayout />}>
            <Route path="/map" element={<h1>지도</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-native-tab-overlay="true"]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });
});
