import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import DesktopHeader from '@/shared/ui/desktop-header/DesktopHeader';

describe('DesktopHeader', () => {
  it('로고로 홈에 가고, 주요 화면 메뉴에서 지금 화면을 표시한다', () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
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
    ).toEqual(['본 방 기록', '인프라 지도', '동네 찾기', '체크리스트', '방 비교']);
    expect(within(nav).getByRole('link', { name: '인프라 지도' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: '본 방 기록' })).not.toHaveAttribute('aria-current');
  });
});
