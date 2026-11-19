import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import ListingLink from '@/pages/neighborhood-preview/ui/listing-link/ListingLink';

it('다방 링크는 정사각형 타일 전체가 새 탭 링크이고 접근성 이름을 유지한다', () => {
  render(<ListingLink areaName="논현1동" center={{ latitude: 37.5, longitude: 127.0 }} />);
  const tile = screen.getByRole('link', { name: '현재 매물 확인하기, 다방에서 논현1동 원·투룸 보기' });
  expect(tile.getAttribute('href')).toContain('dabang');
  expect(tile).toHaveAttribute('target', '_blank');
  expect(tile).toHaveAttribute('rel', 'noopener noreferrer');
  expect(tile.querySelector('img')).not.toBeNull();
  expect(tile.querySelector('svg')).toBeNull();
});
