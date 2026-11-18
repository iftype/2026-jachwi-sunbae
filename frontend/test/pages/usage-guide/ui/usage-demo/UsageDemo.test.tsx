import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';

import UsageDemo from '@/pages/usage-guide/ui/usage-demo/UsageDemo';

const renderDemo = () =>
  render(
    <MemoryRouter>
      <UsageDemo />
    </MemoryRouter>,
  );

it('동네 찾기부터 체크리스트까지 시나리오 네 개를 순서대로 영상과 함께 보여준다', () => {
  const { container } = renderDemo();
  expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
    '1동네 찾기',
    '2거리 메모 남기기',
    '3매물 추가',
    '4체크리스트',
  ]);
  expect(container.querySelectorAll('video')).toHaveLength(4);
});

it('시나리오마다 짧은 순서와 그 기능으로 가는 링크를 둔다', () => {
  renderDemo();
  const memo = screen.getByRole('heading', { name: /거리 메모 남기기/ }).closest('li')!;
  expect(within(memo).getByText('좋아요, 싫어요와 한 줄 남기기')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '동네 찾아보기' })).toHaveAttribute('href', '/neighborhoods');
  expect(screen.getByRole('link', { name: '기록 지도 열기' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: '기록 지도에서 등록하기' })).toHaveAttribute('href', '/?view=map');
  expect(screen.getByRole('link', { name: '체크리스트 보기' })).toHaveAttribute('href', '/checklists');
});
