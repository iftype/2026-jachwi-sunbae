import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import PrivacyPage from '@/pages/privacy/PrivacyPage';

const SourcePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p>{`${location.pathname}${location.search}${location.hash}`}</p>
      <Link to="/privacy#account-deletion">개인정보 안내 열기</Link>
      <button type="button" onClick={() => void navigate(1)}>
        다시 앞으로
      </button>
    </>
  );
};

const TestRoutes = () => (
  <Routes>
    <Route path="/privacy" element={<PrivacyPage />} />
    <Route path="*" element={<SourcePage />} />
  </Routes>
);

describe('개인정보처리방침 뒤로 가기', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it.each(['/login?next=%2Fproperties', '/guide?utm_source=instagram', '/neighborhoods', '/me#account'])(
    '%s에서 들어오면 원래 경로·쿼리·해시로 돌아온다',
    async (path) => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={[path]}>
          <TestRoutes />
        </MemoryRouter>,
      );
      await user.click(screen.getByRole('link', { name: '개인정보 안내 열기' }));
      await user.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }));
      expect(screen.getByText(path)).toBeInTheDocument();
      // 새 링크 이동이 아닌 히스토리 복귀이므로 앞으로 가기로 개인정보 화면을 다시 연다.
      await user.click(screen.getByRole('button', { name: '다시 앞으로' }));
      expect(screen.getByRole('button', { name: '이전 화면으로 돌아가기' })).toBeInTheDocument();
    },
  );

  it('직접 접속하면 소개 화면 대신 기본 진입 경로로 교체한다', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <TestRoutes />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }));
    expect(screen.getByText('/')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 앞으로' }));
    expect(screen.queryByRole('button', { name: '이전 화면으로 돌아가기' })).not.toBeInTheDocument();
  });

  it('새로고침처럼 POP으로 시작해도 앱의 이전 브라우저 이력이 있으면 돌아간다', async () => {
    window.history.replaceState({ idx: 0, key: 'source' }, '', '/login?next=%2Fproperties');
    window.history.pushState({ idx: 1, key: 'privacy' }, '', '/privacy');
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <TestRoutes />
      </BrowserRouter>,
    );
    await user.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }));
    expect(await screen.findByText('/login?next=%2Fproperties')).toBeInTheDocument();
  });
});
