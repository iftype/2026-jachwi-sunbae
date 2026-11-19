import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import MapBadgeRail from '@/shared/ui/map-badge-rail/MapBadgeRail';

const items = [
  { id: 'a', label: '역삼1동' },
  { id: 'b', label: '신림동' },
];

it('뱃지만 그리고, 누르면 그 뱃지를 고른다', async () => {
  const onSelect = vi.fn();
  render(<MapBadgeRail items={items} selectedId={null} onSelect={onSelect} label="찾은 동네" />);
  expect(screen.getAllByRole('button')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: '신림동' }));
  expect(onSelect).toHaveBeenCalledWith('b');
});
