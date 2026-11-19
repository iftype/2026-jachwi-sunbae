import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import { DEFAULT_COMPARE_FILTERS } from '@/pages/property-compare/lib/compareFilters';
import CompareFilters from '@/pages/property-compare/ui/compare-filters/CompareFilters';

it('이름으로 찾는 입력칸 없이 월세와 체크리스트 칩, 결과 개수만 둔다', async () => {
  const onChange = vi.fn();
  render(<CompareFilters filters={DEFAULT_COMPARE_FILTERS} resultCount={4} onChange={onChange} />);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('이름으로 찾기')).not.toBeInTheDocument();
  expect(screen.getByText('4개 매물')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '70만 이하' }));
  expect(onChange).toHaveBeenCalledWith({ rentLimit: 70, checklist: 'all' });
});
