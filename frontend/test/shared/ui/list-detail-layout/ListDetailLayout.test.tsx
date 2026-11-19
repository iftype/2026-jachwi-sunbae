import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import Icon from '@/shared/ui/icon/Icon';
import ListDetailLayout from '@/shared/ui/list-detail-layout/ListDetailLayout';

it('상세가 없으면 목록과 본문만 두고 닫기 버튼을 띄우지 않는다', () => {
  render(
    <ListDetailLayout list={<p>목록</p>} onCloseDetail={vi.fn()}>
      <p>지도</p>
    </ListDetailLayout>,
  );
  expect(screen.getByText('목록')).toBeInTheDocument();
  expect(screen.getByText('지도')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '상세 닫기' })).not.toBeInTheDocument();
});

it('상세를 목록 옆에 붙여 열고 본문 위 닫기 버튼으로 닫는다', async () => {
  const onClose = vi.fn();
  const { container } = render(
    <ListDetailLayout list={<p>목록</p>} detail={<p>상세</p>} onCloseDetail={onClose} closeLabel="체크리스트 닫기">
      <p>지도</p>
    </ListDetailLayout>,
  );
  expect(screen.getByText('목록')).toBeInTheDocument();
  expect(screen.getByText('상세')).toBeInTheDocument();
  expect(container.firstElementChild).toHaveAttribute('data-detail-open', 'true');
  // 지도 시점을 맞추는 쪽이 이 표시로 틀과 상세 칸을 찾아 패널이 가리는 폭을 잰다.
  expect(container.firstElementChild).toHaveAttribute('data-floating', 'true');
  expect(container.querySelector('[data-list-detail-detail]')).toHaveTextContent('상세');
  await userEvent.click(screen.getByRole('button', { name: '체크리스트 닫기' }));
  expect(onClose).toHaveBeenCalledOnce();
});

const svgOf = (name: 'chevron-left' | 'chevron-right') =>
  render(<Icon name={name} size={24} />).container.querySelector('svg')?.outerHTML;

it('접을 수 있는 상세는 `<` 버튼으로 접고 `>` 버튼으로 펴며, 접어도 상세 내용은 남기고 초점을 옮긴다', async () => {
  const user = userEvent.setup();
  const collapseIcon = svgOf('chevron-left');
  const expandIcon = svgOf('chevron-right');
  const { container } = render(
    <ListDetailLayout list={<p>목록</p>} detail={<p>상세</p>} collapsible>
      <p>지도</p>
    </ListDetailLayout>,
  );
  const layout = container.querySelector('[data-floating]');
  const collapse = screen.getByRole('button', { name: '상세 접기' });
  expect(collapse).toHaveAttribute('aria-expanded', 'true');
  expect(collapse.querySelector('svg')?.outerHTML).toBe(collapseIcon);
  expect(screen.queryByRole('button', { name: '상세 닫기' })).not.toBeInTheDocument();

  await user.click(collapse);
  // 접으면 상세는 숨기기만 하고 지우지 않는다. 지도 위 요소가 비켜 놓는 폭도 목록 패널만큼으로 준다.
  expect(screen.getByText('상세')).not.toBeVisible();
  expect(layout).not.toHaveAttribute('data-detail-open');
  const expand = screen.getByRole('button', { name: '상세 펼치기' });
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect(expand.querySelector('svg')?.outerHTML).toBe(expandIcon);
  expect(expand).toHaveFocus();
  expect(screen.queryByRole('button', { name: '상세 접기' })).not.toBeInTheDocument();

  await user.click(expand);
  expect(screen.getByText('상세')).toBeVisible();
  expect(layout).toHaveAttribute('data-detail-open', 'true');
  expect(screen.getByRole('button', { name: '상세 접기' })).toHaveFocus();
});

it('접은 상태는 다른 상세로 바뀌어도, 다시 그려도(새로고침) 유지한다', async () => {
  const user = userEvent.setup();
  const view = render(
    <ListDetailLayout list={<p>목록</p>} detail={<p>첫 매물</p>} collapsible>
      <p>지도</p>
    </ListDetailLayout>,
  );
  await user.click(screen.getByRole('button', { name: '상세 접기' }));
  view.rerender(
    <ListDetailLayout list={<p>목록</p>} detail={<p>둘째 매물</p>} collapsible>
      <p>지도</p>
    </ListDetailLayout>,
  );
  expect(screen.getByText('둘째 매물')).not.toBeVisible();
  expect(screen.getByRole('button', { name: '상세 펼치기' })).toBeInTheDocument();

  view.unmount();
  render(
    <ListDetailLayout list={<p>목록</p>} detail={<p>둘째 매물</p>} collapsible>
      <p>지도</p>
    </ListDetailLayout>,
  );
  expect(screen.getByText('둘째 매물')).not.toBeVisible();
});

it('접을 수 없는 상세는 접어 둔 선호와 상관없이 펼쳐 보이고 닫기 버튼을 둔다', () => {
  localStorage.setItem('jachwi.detail-panel-collapsed', 'true');
  render(
    <ListDetailLayout list={<p>목록</p>} detail={<p>대중교통</p>} onCloseDetail={vi.fn()}>
      <p>지도</p>
    </ListDetailLayout>,
  );
  expect(screen.getByText('대중교통')).toBeVisible();
  expect(screen.getByRole('button', { name: '상세 닫기' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '상세 펼치기' })).not.toBeInTheDocument();
});
