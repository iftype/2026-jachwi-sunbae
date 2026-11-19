import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MAP_LAYER } from '@/shared/lib/map-layers/mapLayers';

import BottomSheet from './BottomSheet';
import { hideWhenSheetExpanded } from './hideWhenSheetExpanded';

const renderSheet = () =>
  render(
    <BottomSheet
      title="동네 정보"
      fullPage={false}
      onClose={() => undefined}
      floating={
        <button type="button" className={hideWhenSheetExpanded} aria-label="내 현재 위치로 이동">
          위치
        </button>
      }
    >
      내용
    </BottomSheet>,
  );

describe('BottomSheet floating 현재 위치 버튼', () => {
  it('시트 밖 아래층에 두어 지도 위 카드(머리 줄, 찜 토글, 시설 분류 카드)보다 아래에 깔리고, 처음에는 보인다', () => {
    renderSheet();
    const button = screen.getByRole('button', { name: '내 현재 위치로 이동' });
    const sheet = screen.getByRole('region', { name: '동네 정보' });
    expect(sheet.contains(button)).toBe(false);
    const layer = button.parentElement;
    expect(layer).not.toBeNull();
    if (layer === null) return;
    expect(Number(getComputedStyle(layer).zIndex)).toBe(MAP_LAYER.sheetFloating);
    expect(Number(getComputedStyle(sheet).zIndex)).toBe(MAP_LAYER.sheet);
    expect(getComputedStyle(button).visibility).not.toBe('hidden');
  });

  it('층 순서는 띄운 버튼 < 지도 위 카드 <= 시트 < 화면 전체 시트다', () => {
    const cards = [MAP_LAYER.header, MAP_LAYER.bookmarkToggle, MAP_LAYER.categoryRail];
    expect(cards.every((card) => MAP_LAYER.sheetFloating < card)).toBe(true);
    expect(cards.every((card) => card <= MAP_LAYER.sheet)).toBe(true);
    expect(MAP_LAYER.sheet).toBeLessThan(MAP_LAYER.fullPageSheet);
  });

  it('시트를 크게 열면 숨기고, 다시 낮추면 보인다', () => {
    renderSheet();
    const sheet = screen.getByRole('region', { name: '동네 정보' });
    const handle = screen.getByRole('button', { name: '상세 패널 높이 조절' });
    const locate = () => screen.getByText('위치');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(sheet.dataset.mode).toBe('expanded');
    expect(getComputedStyle(locate()).visibility).toBe('hidden');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(sheet.dataset.mode).toBe('default');
    expect(getComputedStyle(locate()).visibility).not.toBe('hidden');
  });
});
