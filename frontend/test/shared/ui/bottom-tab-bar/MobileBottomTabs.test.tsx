import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import MobileBottomTabs from '@/shared/ui/bottom-tab-bar/MobileBottomTabs';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileBottomTabs />
      <input aria-label="입력창" />
    </MemoryRouter>,
  );

afterEach(() => {
  delete window.__JACHWI_NATIVE_APP__;
});

describe('휴대폰 하단 탭', () => {
  it('여섯 개 탭을 두고 지금 화면만 aria-current로 표시한다', () => {
    renderAt('/neighborhoods');
    const bar = screen.getByRole('navigation', { name: '하단 탭' });
    expect(bar.querySelectorAll('button')).toHaveLength(6);
    expect(screen.getByRole('button', { name: '동네 찾기' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '내 기록' })).not.toHaveAttribute('aria-current');
    expect(bar.lastElementChild).toBe(screen.getByRole('button', { name: '마이' }));
    expect(screen.queryByRole('button', { name: '사용방법' })).not.toBeInTheDocument();
  });

  it('앱에서는 내 기록, 동네 찾기, 마이 세 탭만 둔다', () => {
    window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 1 };
    renderAt('/neighborhoods');
    const bar = screen.getByRole('navigation', { name: '하단 탭' });
    expect(Array.from(bar.querySelectorAll('button')).map((button) => button.textContent)).toEqual([
      '내 기록',
      '동네 찾기',
      '마이',
    ]);
    expect(screen.queryByRole('button', { name: '저렴한 한 끼' })).not.toBeInTheDocument();
  });

  it('마이 탭을 눌러 마이페이지로 갈 수 있다', () => {
    renderAt('/cheap-meals/restaurant');
    fireEvent.click(screen.getByRole('button', { name: '마이' }));
    expect(screen.getByRole('button', { name: '마이' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/properties/3', '/properties/3/edit', '/search', '/checklists/new'])(
    '%s에서는 탭을 그리지 않는다',
    (path) => {
      renderAt(path);
      expect(screen.queryByRole('navigation', { name: '하단 탭' })).not.toBeInTheDocument();
    },
  );

  it('입력창에 포커스가 가면 탭을 숨기고 아래 여백 변수를 지운다', () => {
    renderAt('/');
    expect(document.documentElement.style.getPropertyValue('--mobile-tab-space')).not.toBe('');
    fireEvent.focusIn(screen.getByLabelText('입력창'));
    expect(document.querySelector('nav[aria-label="하단 탭"]')).toHaveAttribute('data-hidden', 'true');
    expect(document.documentElement.style.getPropertyValue('--mobile-tab-space')).toBe('');
  });
});
