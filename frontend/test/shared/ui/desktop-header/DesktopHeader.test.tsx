import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import DesktopHeader from '@/shared/ui/desktop-header/DesktopHeader';

describe('DesktopHeader', () => {
  it('로고로 홈에 가고, 주요 화면 메뉴에서 지금 화면을 표시한다', () => {
    render(
      <MemoryRouter initialEntries={['/neighborhoods']}>
        <DesktopHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute('href', '/me');
    const nav = screen.getByRole('navigation', { name: '주요 화면' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['본 방 기록', '동네 찾기', '방 비교']);
    expect(within(nav).getByRole('link', { name: '동네 찾기' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: '본 방 기록' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '마이페이지' })).not.toHaveAttribute('aria-current');
  });

  it('마이 화면에서는 프로필 링크를 지금 화면으로 표시한다', () => {
    render(
      <MemoryRouter initialEntries={['/me']}>
        <DesktopHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute('aria-current', 'page');
    const nav = screen.getByRole('navigation', { name: '주요 화면' });
    expect(within(nav).queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });
});
