import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import { readBookmarkLayerOn, writeBookmarkLayerOn } from '@/pages/design-records/model/bookmarkLayer';
import MapBookmarkToggle from '@/features/map/ui/map-bookmark-toggle/MapBookmarkToggle';

it('꺼져 있으면 `찜한 동네 보기`, 켜져 있으면 `찜한 동네 숨기기`로 알리고 누르면 토글을 부른다', async () => {
  const toggle = vi.fn();
  const { rerender } = render(<MapBookmarkToggle isOn={false} count={3} onToggle={toggle} />);
  const off = screen.getByRole('button', { name: '찜한 동네 보기, 3곳' });
  expect(off).toHaveAttribute('aria-pressed', 'false');
  await userEvent.click(off);
  expect(toggle).toHaveBeenCalledOnce();
  rerender(<MapBookmarkToggle isOn count={3} onToggle={toggle} />);
  expect(screen.getByRole('button', { name: '찜한 동네 숨기기, 3곳' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('3')).toBeInTheDocument();
});

it('찜한 동네가 없으면 개수 뱃지를 그리지 않는다', () => {
  render(<MapBookmarkToggle isOn={false} count={0} onToggle={vi.fn()} />);
  expect(screen.getByRole('button', { name: /동네 찾기로 가서 찜하기/ })).toHaveTextContent('찜');
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});

it('켜고 끈 상태를 기억해 다음에 열어도 이어 쓴다', () => {
  expect(readBookmarkLayerOn()).toBe(false);
  writeBookmarkLayerOn(true);
  expect(readBookmarkLayerOn()).toBe(true);
  writeBookmarkLayerOn(false);
  expect(readBookmarkLayerOn()).toBe(false);
});
