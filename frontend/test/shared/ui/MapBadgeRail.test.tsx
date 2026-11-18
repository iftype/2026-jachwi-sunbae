import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import MapBadgeRail from '@/shared/ui/map-badge-rail/MapBadgeRail';

const items = [
  { id: 'a', label: '역삼1동' },
  { id: 'b', label: '신림동' },
];

it('맨 앞 칩은 뱃지 줄 밖에 두고, 눌러도 뱃지 선택은 바꾸지 않는다', async () => {
  const onSelect = vi.fn();
  const onLeading = vi.fn();
  render(
    <MapBadgeRail
      items={items}
      selectedId="a"
      onSelect={onSelect}
      label="찾은 동네"
      leading={{ label: '다시 뽑기', onClick: onLeading }}
    />,
  );
  const chip = screen.getByRole('button', { name: '다시 뽑기' });
  expect(screen.getByRole('navigation', { name: '찾은 동네' })).not.toContainElement(chip);
  await userEvent.click(chip);
  expect(onLeading).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
});

it('앞 칩이 없으면 뱃지만 그린다', () => {
  render(<MapBadgeRail items={items} selectedId={null} onSelect={vi.fn()} label="찾은 동네" />);
  expect(screen.queryByRole('button', { name: '다시 뽑기' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(2);
});
