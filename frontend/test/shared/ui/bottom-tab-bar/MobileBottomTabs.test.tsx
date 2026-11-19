import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import MobileBottomTabs from '@/shared/ui/bottom-tab-bar/MobileBottomTabs';

const Where = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="주소">{pathname + search}</output>;
};

const Tabs = () => {
  const [view, setView] = useState<'list' | 'map'>('map');
  return <MobileBottomTabs recordsView={view} onRecordsViewChange={setView} />;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Tabs />
      <Where />
      <input aria-label="입력창" />
    </MemoryRouter>,
  );

afterEach(() => {
  window.localStorage.clear();
  delete window.__JACHWI_NATIVE_APP__;
});

describe('휴대폰 하단 탭', () => {
  it('웹에서는 내 기록, 동네 찾기, 마이 세 탭을 두고 지금 화면만 aria-current로 표시한다', () => {
    renderAt('/neighborhoods');
    const bar = screen.getByRole('navigation', { name: '하단 탭' });
    expect(Array.from(bar.querySelectorAll('button')).map((button) => button.textContent)).toEqual([
      '내 기록',
      '동네 찾기',
      '마이',
    ]);
    expect(screen.getByRole('button', { name: '동네 찾기' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '내 기록' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('button', { name: '저렴한 한 끼' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사용방법' })).not.toBeInTheDocument();
  });

  it('앱에서도 웹과 같은 세 탭을 둔다', () => {
    window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 1 };
    renderAt('/neighborhoods');
    const bar = screen.getByRole('navigation', { name: '하단 탭' });
    expect(Array.from(bar.querySelectorAll('button')).map((button) => button.textContent)).toEqual([
      '내 기록',
      '동네 찾기',
      '마이',
    ]);
  });

  it('마이 탭을 눌러 마이페이지로 갈 수 있다', () => {
    renderAt('/neighborhoods');
    fireEvent.click(screen.getByRole('button', { name: '마이' }));
    expect(screen.getByRole('button', { name: '마이' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    '/properties/3',
    '/properties/3/edit',
    '/search',
    '/checklists/new',
    '/checklists',
    '/compare',
    '/cheap-meals',
    '/cheap-meals/restaurant',
  ])('%s에서는 탭을 그리지 않는다', (path) => {
    renderAt(path);
    expect(screen.queryByRole('navigation', { name: '하단 탭' })).not.toBeInTheDocument();
  });

  it('입력창에 포커스가 가면 탭을 숨기고 아래 여백 변수를 지운다', () => {
    renderAt('/');
    expect(document.documentElement.style.getPropertyValue('--mobile-tab-space')).not.toBe('');
    fireEvent.focusIn(screen.getByLabelText('입력창'));
    expect(document.querySelector('nav[aria-label="하단 탭"]')).toHaveAttribute('data-hidden', 'true');
    expect(document.documentElement.style.getPropertyValue('--mobile-tab-space')).toBe('');
  });

  it('내 기록 화면에서 내 기록 탭을 다시 누르면 지도와 리스트를 오가고, 이름에 다음 동작을 알린다', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: '내 기록, 리스트로 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '내 기록, 지도로 보기' }));
    expect(screen.getByRole('button', { name: '내 기록, 리스트로 보기' })).toBeInTheDocument();
    expect(screen.getByLabelText('주소')).toHaveTextContent(/^\/$/);
  });

  it('다른 화면에서 내 기록 탭을 누르면 보기는 바꾸지 않고 이동만 한다', () => {
    renderAt('/neighborhoods');
    fireEvent.click(screen.getByRole('button', { name: '내 기록' }));
    expect(screen.getByLabelText('주소')).toHaveTextContent(/^\/$/);
  });
});
