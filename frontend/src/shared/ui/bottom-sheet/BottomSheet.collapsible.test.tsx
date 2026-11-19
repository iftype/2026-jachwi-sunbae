import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BottomSheet from './BottomSheet';
import { setSheetCollapsed, useSheetCollapsed } from './sheetCollapse';

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

/** 동네 찾기와 내 기록 모바일 지도가 쓰는 연결: 접힘 선호를 세션 상태에 두고 시트에 넘긴다. */
const SharedSheet = ({ isOpen = true }: { isOpen?: boolean }) => {
  const collapsed = useSheetCollapsed();
  if (!isOpen) return null;
  return (
    <BottomSheet
      title="선택한 매물"
      fullPage={false}
      collapsible
      initialMode={collapsed ? 'peek' : 'default'}
      onModeChange={(mode) => setSheetCollapsed(mode === 'peek')}
      onClose={() => undefined}
    >
      내용
    </BottomSheet>
  );
};

describe('BottomSheet 접힘 선호 공유', () => {
  afterEach(() => act(() => setSheetCollapsed(false)));

  it('접어 둔 선호는 시트를 닫았다 다시 열어도 접힌 채 열린다', () => {
    const { rerender } = render(<SharedSheet />);
    fireEvent.click(screen.getByRole('button', { name: '시트 접기' }));
    rerender(<SharedSheet isOpen={false} />);
    rerender(<SharedSheet />);
    expect(screen.getByRole('region', { name: '선택한 매물' }).dataset.mode).toBe('peek');
  });

  it('마커를 눌러 접힘 선호가 풀리면 접힌 시트가 펼쳐진다', () => {
    render(<SharedSheet />);
    fireEvent.click(screen.getByRole('button', { name: '시트 접기' }));
    act(() => setSheetCollapsed(false));
    expect(screen.getByRole('region', { name: '선택한 매물' }).dataset.mode).toBe('default');
    expect(screen.getByRole('button', { name: '시트 접기' })).toBeInTheDocument();
  });

  it('손잡이로 펼치면 접힘 선호도 풀린다', () => {
    render(<SharedSheet />);
    fireEvent.click(screen.getByRole('button', { name: '시트 접기' }));
    fireEvent.click(screen.getByRole('button', { name: '시트 펼치기' }));
    expect(screen.getByRole('region', { name: '선택한 매물' }).dataset.mode).toBe('default');
  });
});
