import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

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
  await userEvent.click(screen.getByRole('button', { name: '체크리스트 닫기' }));
  expect(onClose).toHaveBeenCalledOnce();
});
