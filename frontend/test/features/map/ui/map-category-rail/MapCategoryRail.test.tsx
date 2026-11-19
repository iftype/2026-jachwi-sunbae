import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import MapCategoryRail from '@/features/map/ui/map-category-rail/MapCategoryRail';

const railButtons = () => screen.getAllByRole('button').map((button) => button.textContent);

it('기본으로는 메모를 빼고 중개업소까지 모든 시설 카테고리를 둔다', () => {
  render(<MapCategoryRail selectedCategories={[]} onToggle={vi.fn()} />);
  expect(railButtons()).toEqual(['교통', '편의점', '병원', '학교', '중개사']);
});

it('hiddenCategories로 넘긴 카테고리만 그 화면에서 뺀다', () => {
  render(
    <MapCategoryRail
      showMemo
      showIcons={false}
      hiddenCategories={['AGENCY']}
      selectedCategories={[]}
      onToggle={vi.fn()}
    />,
  );
  expect(railButtons()).toEqual(['메모', '교통', '편의점', '병원', '학교']);
});
