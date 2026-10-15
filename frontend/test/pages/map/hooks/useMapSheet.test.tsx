import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import useMapSheet from '@/pages/map/hooks/useMapSheet';

afterEach(() => vi.restoreAllMocks());

it('중간 높이나 전체 높이로 열린 상태에서 손잡이를 클릭하면 바로 닫는다', async () => {
  const Harness = () => {
    const sheet = useMapSheet();
    return (
      <>
        <output aria-label="시트 단계">{sheet.sheetStage}</output>
        <button onClick={sheet.toggleSheet}>열기 닫기</button>
        <button onClick={sheet.expandSheet}>전체 펼침</button>
      </>
    );
  };
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '열기 닫기' }));
  expect(screen.getByLabelText('시트 단계')).toHaveTextContent('mid');
  await userEvent.click(screen.getByRole('button', { name: '열기 닫기' }));
  expect(screen.getByLabelText('시트 단계')).toHaveTextContent('closed');
  await userEvent.click(screen.getByRole('button', { name: '전체 펼침' }));
  expect(screen.getByLabelText('시트 단계')).toHaveTextContent('full');
  await userEvent.click(screen.getByRole('button', { name: '열기 닫기' }));
  expect(screen.getByLabelText('시트 단계')).toHaveTextContent('closed');
});

it('탭 뒤의 시트 배경은 자르지 않고 카드 높이와 탭 여백을 합쳐 펼친다', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const height = this.dataset.stage !== undefined ? 800 : this.dataset.sheet !== undefined ? 700 : 36;
    return { height, width: 390, x: 0, y: 0, top: 0, left: 0, right: 390, bottom: height, toJSON: () => ({}) };
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);
  const Harness = () => {
    const sheet = useMapSheet();
    return (
      <div data-stage>
        <section ref={sheet.sheetRef} data-sheet data-single="true" style={{ paddingBottom: 88 }}>
          <button onClick={sheet.previewSheet}>펼치기</button>
          <button onClick={sheet.closeSheet}>닫기</button>
          <button onClick={sheet.expandSheet}>전체 높이</button>
          <div data-sheet-content hidden={sheet.sheetStage === 'closed'}>
            매물 카드
          </div>
        </section>
      </div>
    );
  };
  const { container } = render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '펼치기' }));
  const sheet = container.querySelector<HTMLElement>('[data-sheet]')!;
  expect(sheet.style.transform).toBe('translate3d(0, 476px, 0)');
  expect(sheet.style.clipPath).toBe('');
  expect(sheet.style.getPropertyValue('--map-sheet-content-height')).toBe('100px');
  expect(sheet.parentElement?.style.getPropertyValue('--map-sheet-visible-height')).toBe('144px');
  await userEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(sheet.style.getPropertyValue('--map-sheet-content-height')).toBe('100px');
  fireEvent.transitionEnd(sheet, { propertyName: 'transform' });
  expect(sheet.style.getPropertyValue('--map-sheet-content-height')).toBe('100px');
  await userEvent.click(screen.getByRole('button', { name: '전체 높이' }));
  const fullContentHeight = sheet.style.getPropertyValue('--map-sheet-content-height');
  await userEvent.click(screen.getByRole('button', { name: '펼치기' }));
  expect(sheet.style.getPropertyValue('--map-sheet-content-height')).toBe(fullContentHeight);
  fireEvent.transitionEnd(sheet, { propertyName: 'transform' });
  expect(sheet.style.getPropertyValue('--map-sheet-content-height')).toBe('100px');
});
