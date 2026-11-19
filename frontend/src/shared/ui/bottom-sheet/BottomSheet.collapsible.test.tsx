import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BottomSheet from './BottomSheet';

const renderSheet = (
  props: { onClose?: () => void; initialMode?: 'peek' | 'default'; onModeChange?: (mode: string) => void } = {},
) =>
  render(
    <BottomSheet
      title="선택한 매물"
      fullPage={false}
      collapsible
      onClose={props.onClose ?? (() => undefined)}
      {...props}
    >
      내용
    </BottomSheet>,
  );

describe('BottomSheet 접기', () => {
  it('접기 버튼으로 제목만 남기고 접으며 닫지 않는다', () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    const sheet = screen.getByRole('region', { name: '선택한 매물' });
    fireEvent.click(screen.getByRole('button', { name: '시트 접기' }));
    expect(sheet.dataset.mode).toBe('peek');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('접힌 시트는 펼치기 버튼과 손잡이 누르기로 다시 펼쳐진다', () => {
    renderSheet({ initialMode: 'peek' });
    const sheet = screen.getByRole('region', { name: '선택한 매물' });
    fireEvent.click(screen.getByRole('button', { name: '시트 펼치기' }));
    expect(sheet.dataset.mode).toBe('default');
    fireEvent.click(screen.getByRole('button', { name: '시트 접기' }));
    fireEvent.click(screen.getByRole('button', { name: '상세 패널 높이 조절' }));
    expect(sheet.dataset.mode).toBe('default');
  });

  it('높이 단계가 바뀌면 알린다', () => {
    const onModeChange = vi.fn();
    renderSheet({ onModeChange });
    fireEvent.click(screen.getByRole('button', { name: '시트 접기' }));
    expect(onModeChange).toHaveBeenLastCalledWith('peek');
  });

  it('접을 수 없는 시트에는 접기 버튼이 없다', () => {
    render(
      <BottomSheet title="상세" onClose={() => undefined}>
        내용
      </BottomSheet>,
    );
    expect(screen.queryByRole('button', { name: '시트 접기' })).toBeNull();
  });
});
