import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { expect, it, vi } from 'vitest';

import MapPropertySheet from '@/pages/map/ui/map-property-sheet/MapPropertySheet';

it('닫힌 시트도 내부를 유지하고 드래그가 시작되면 내부 상태를 노출한다', () => {
  const props = {
    sheetRef: createRef<HTMLElement>(),
    stage: 'closed' as const,
    isDragging: false,
    isLoading: true,
    isError: false,
    onRetry: vi.fn(),
    properties: [],
    selectedPropertyId: null,
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn(),
    onDragCancel: vi.fn(),
    onToggle: vi.fn(),
  };
  const { container, rerender } = render(<MapPropertySheet {...props} />);
  const body = container.querySelector<HTMLElement>('[data-sheet-content]')!;
  expect(body.hidden).toBe(false);
  expect(body).toHaveAttribute('aria-hidden', 'true');
  expect(body).toHaveAttribute('inert');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  rerender(<MapPropertySheet {...props} isDragging />);
  expect(screen.getByRole('status')).toHaveTextContent('매물을 불러오는 중이에요.');
  expect(body).toHaveAttribute('aria-hidden', 'false');
  expect(body).not.toHaveAttribute('inert');

  rerender(<MapPropertySheet {...props} isDragging isLoading={false} />);
  expect(screen.getByText('현재 지도 화면에 등록된 매물이 없어요.')).toBeVisible();
});
