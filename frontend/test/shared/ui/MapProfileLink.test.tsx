import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MapProfileLink from '@/shared/ui/map-profile-link/MapProfileLink';

afterEach(() => {
  delete window.__JACHWI_NATIVE_APP__;
  vi.restoreAllMocks();
});

const setDesktop = (isDesktop: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: isDesktop && query === '(min-width: 1024px)',
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );

const show = () =>
  render(
    <MemoryRouter>
      <MapProfileLink />
    </MemoryRouter>,
  );

describe.each([
  ['웹', undefined],
  ['앱', { platform: 'ios', version: 1 } as const],
])('%s', (_name, nativeApp) => {
  beforeEach(() => {
    if (nativeApp) window.__JACHWI_NATIVE_APP__ = nativeApp;
  });

  it('휴대폰 화면에서는 하단 탭에 마이가 있으니 마이페이지 링크를 없앤다', () => {
    setDesktop(false);
    show();
    expect(screen.queryByRole('link', { name: '마이페이지' })).not.toBeInTheDocument();
  });

  it('하단 탭이 없는 데스크탑 폭에서는 링크를 둔다', () => {
    setDesktop(true);
    show();
    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute('href', '/me');
  });
});
