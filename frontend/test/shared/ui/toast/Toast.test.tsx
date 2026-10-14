import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import Toast from '@/shared/ui/toast/Toast';

it('안내를 읽을 수 있게 표시하고 정해진 시간 후 닫기를 요청한다', () => {
  vi.useFakeTimers();
  try {
    const close = vi.fn();
    const { unmount } = render(
      <Toast isOpen title="안내" description="지도에서 선택해주세요." duration={8000} onClose={close} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('지도에서 선택해주세요.');
    act(() => vi.advanceTimersByTime(7999));
    expect(close).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(close).toHaveBeenCalledOnce();
    unmount();
  } finally {
    vi.useRealTimers();
  }
});
it('닫힌 토스트는 표시하지 않고 해제 시 타이머도 정리한다', () => {
  vi.useFakeTimers();
  try {
    const close = vi.fn();
    const { rerender } = render(<Toast isOpen title="안내" onClose={close} />);
    rerender(<Toast isOpen={false} title="안내" onClose={close} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(8000));
    expect(close).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
