import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import NavRail, { NavRailPlaceholder } from '@/shared/ui/nav-rail/NavRail';
import { NAV_RAIL_ITEMS } from '@/shared/ui/nav-rail/navRailItems';

it('칸마다 이름이 있는 버튼을 만들고 지금 보는 화면에만 현재 표시를 단다', () => {
  render(
    <NavRail
      label="화면 이동"
      items={NAV_RAIL_ITEMS.map((item) => ({ ...item, isActive: item.key === 'records', onSelect: () => undefined }))}
    />,
  );
  const rail = screen.getByRole('navigation', { name: '화면 이동' });
  expect(rail.querySelectorAll('button')).toHaveLength(NAV_RAIL_ITEMS.length);
  expect(screen.getByRole('button', { name: '내 기록' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: '동네 찾기' })).not.toHaveAttribute('aria-current');
});

it('칸을 누르면 그 칸의 이동 동작을 부른다', async () => {
  const onSelect = vi.fn();
  render(
    <NavRail
      label="화면 이동"
      items={[{ key: 'register', label: '본 방 기록하기', image: 'x.webp', isActive: false, onSelect }]}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '본 방 기록하기' }));
  expect(onSelect).toHaveBeenCalledOnce();
});

it('뼈대용 자리 표시는 누를 수 없고 보조 기술에서 숨긴다', () => {
  render(<NavRailPlaceholder items={NAV_RAIL_ITEMS} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('레일의 칸 이름은 겹치지 않고 도구 화면 칸은 이동 경로를 가진다', () => {
  const labels = NAV_RAIL_ITEMS.map((item) => item.label);
  expect(new Set(labels).size).toBe(labels.length);
  expect(NAV_RAIL_ITEMS.find((item) => item.key === 'compare')?.path).toBeDefined();
});
