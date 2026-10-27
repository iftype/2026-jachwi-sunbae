import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { expect, it } from 'vitest';

import useReturnNavigation from '@/shared/lib/navigation/useReturnNavigation';

const ChecklistScreen = ({ cameFromTarget }: { cameFromTarget: boolean }) => {
  const goBack = useReturnNavigation({ cameFromTarget, fallback: '/properties/10' });
  return (
    <button type="button" onClick={goBack}>
      저장
    </button>
  );
};

const createRouter = (initialEntries: string[], cameFromTarget: boolean) =>
  createMemoryRouter(
    [
      { path: '/properties', element: <h1>기록 화면</h1> },
      {
        path: '/properties/10',
        element: (
          <>
            <h1>매물 상세</h1>
            <Link to="/properties/10/checklists/72">체크리스트</Link>
          </>
        ),
      },
      { path: '/properties/10/checklists/72', element: <ChecklistScreen cameFromTarget={cameFromTarget} /> },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );

it('돌아갈 화면에서 들어왔으면 기록을 쌓지 않고 뒤로 간다', async () => {
  const user = userEvent.setup();
  const router = createRouter(['/properties', '/properties/10'], true);
  render(<RouterProvider router={router} />);

  await user.click(screen.getByRole('link', { name: '체크리스트' }));
  await user.click(screen.getByRole('button', { name: '저장' }));

  expect(await screen.findByRole('heading', { name: '매물 상세' })).toBeInTheDocument();
  expect(router.state.historyAction).toBe('POP');
  // 상세로 새로 이동했다면 한 번 더 뒤로 가도 상세가 남아 있었을 것이다.
  await router.navigate(-1);
  expect(await screen.findByRole('heading', { name: '기록 화면' })).toBeInTheDocument();
});

it('이전 기록이 없으면 지금 기록을 돌아갈 화면으로 바꾼다', async () => {
  const user = userEvent.setup();
  const router = createRouter(['/properties/10/checklists/72'], true);
  render(<RouterProvider router={router} />);

  await user.click(screen.getByRole('button', { name: '저장' }));

  expect(await screen.findByRole('heading', { name: '매물 상세' })).toBeInTheDocument();
  expect(router.state.historyAction).toBe('REPLACE');
});

it('다른 화면에서 들어왔으면 돌아갈 화면으로 바꿔 이동한다', async () => {
  const user = userEvent.setup();
  const router = createRouter(['/properties', '/properties/10'], false);
  render(<RouterProvider router={router} />);

  await user.click(screen.getByRole('link', { name: '체크리스트' }));
  await user.click(screen.getByRole('button', { name: '저장' }));

  expect(await screen.findByRole('heading', { name: '매물 상세' })).toBeInTheDocument();
  expect(router.state.historyAction).toBe('REPLACE');
});
