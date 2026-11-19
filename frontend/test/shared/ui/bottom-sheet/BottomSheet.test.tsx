import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';

import { expectSheetStages } from './sheetStages';

const renderSheet = (props: Partial<Parameters<typeof BottomSheet>[0]> = {}) => {
  const onClose = vi.fn();
  const view = render(
    <BottomSheet title="역삼1동" onClose={onClose} showCloseButton={false} fullPage {...props}>
      <p>내용</p>
    </BottomSheet>,
  );
  return { onClose, view, sheet: () => screen.getByRole('region', { name: '역삼1동' }) };
};

it('손잡이를 누르기만 해서는 높이를 바꾸지 않고, 위·아래 화살표로 한 단계씩 바꾼다', async () => {
  const user = userEvent.setup();
  const { sheet } = renderSheet();
  const handle = screen.getByRole('button', { name: '상세 패널 높이 조절' });
  await user.click(handle);
  expect(sheet()).toHaveAttribute('data-mode', 'default');
  handle.focus();
  await user.keyboard('{ArrowUp}');
  expect(sheet()).toHaveAttribute('data-mode', 'expanded');
  await user.keyboard('{ArrowDown}{ArrowDown}');
  expect(sheet()).toHaveAttribute('data-mode', 'peek');
});

it('끝까지 올리면 손잡이 없이 헤더에 뒤로가기·닫기가 있는 페이지가 되고, 뒤로가기로 시트에 돌아온다', async () => {
  const user = userEvent.setup();
  const { sheet, onClose } = renderSheet();
  expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '상세 닫기' })).not.toBeInTheDocument();
  screen.getByRole('button', { name: '상세 패널 높이 조절' }).focus();
  await user.keyboard('{ArrowUp}{ArrowUp}');
  expect(sheet()).toHaveAttribute('data-mode', 'full');
  expect(screen.queryByRole('button', { name: '상세 패널 높이 조절' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(sheet()).toHaveAttribute('data-mode', 'default');
  screen.getByRole('button', { name: '상세 패널 높이 조절' }).focus();
  await user.keyboard('{ArrowUp}{ArrowUp}');
  await user.click(screen.getByRole('button', { name: '상세 닫기' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('fullPage가 아니면 끝까지 올려도 페이지로 바꾸지 않는다', async () => {
  const user = userEvent.setup();
  const { sheet } = renderSheet({ fullPage: false });
  screen.getByRole('button', { name: '상세 패널 높이 조절' }).focus();
  await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
  expect(sheet()).toHaveAttribute('data-mode', 'expanded');
});

it('onBack을 주면 시트 높이와 상관없이 제목 왼쪽에 뒤로가기를 둔다', async () => {
  const user = userEvent.setup();
  const onBack = vi.fn();
  renderSheet({ onBack });
  await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('peekSignal이 바뀌면 제목만 보이게 내리고, 처음 렌더링에서는 내리지 않는다', () => {
  const { sheet, view } = renderSheet({ peekSignal: 0 });
  expect(sheet()).toHaveAttribute('data-mode', 'default');
  view.rerender(
    <BottomSheet title="역삼1동" onClose={() => undefined} showCloseButton={false} fullPage peekSignal={1}>
      <p>내용</p>
    </BottomSheet>,
  );
  expect(sheet()).toHaveAttribute('data-mode', 'peek');
});

it('headerEnd는 제목 오른쪽 끝에 두고, 페이지로 열려 닫기가 생기면 그 왼쪽에 둔다', async () => {
  const user = userEvent.setup();
  renderSheet({ headerEnd: <a href="https://example.com">외부 링크</a> });
  const header = screen.getByRole('heading', { name: '역삼1동' }).closest('header')!;
  expect(header.lastElementChild).toHaveTextContent('외부 링크');
  screen.getByRole('button', { name: '상세 패널 높이 조절' }).focus();
  await user.keyboard('{ArrowUp}{ArrowUp}');
  const buttons = [...header.children].map((child) => child.textContent || child.getAttribute('aria-label'));
  expect(buttons.indexOf('외부 링크')).toBeLessThan(buttons.indexOf('상세 닫기'));
});

it('subtitle은 제목 아래 작은 한 줄로 둔다', () => {
  renderSheet({ subtitle: '서울특별시 강남구 역삼1동' });
  const titles = screen.getByRole('heading', { name: '역삼1동' }).parentElement!;
  expect(titles).toHaveTextContent('서울특별시 강남구 역삼1동');
});

/** jsdom은 레이아웃이 없어 시트와 부모 높이를 정해 둔다. 부모 800px, 시트는 인라인 높이가 있으면 그 값, 없으면 400px. */
const mockSheetLayout = (sheet: HTMLElement) => {
  const rect = (height: number) => ({
    height,
    width: 390,
    top: 0,
    left: 0,
    right: 390,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  sheet.parentElement!.getBoundingClientRect = () => rect(800) as DOMRect;
  sheet.getBoundingClientRect = () => {
    const inline = sheet.style.getPropertyValue('--sheet-height');
    return rect(inline ? Number.parseFloat(inline) : 400) as DOMRect;
  };
};
const dragHandle = (by: number, { release = true } = {}) => {
  const handle = screen.getByRole('button', { name: '상세 패널 높이 조절' });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 600 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 600 - by / 2 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 600 - by });
  if (release) fireEvent.pointerUp(handle, { pointerId: 1, clientY: 600 - by });
  return handle;
};

it.each([
  { by: 300, mode: 'full', label: '끝까지(85% 넘게) 올리면 페이지로' },
  { by: 150, mode: 'expanded', label: '60%를 넘게 올리면 크게' },
  { by: 50, mode: 'default', label: '조금 올리면 처음 높이로' },
])('손잡이를 끌어 놓으면 놓은 높이에 따라 단계를 정한다: $label', ({ by, mode }) => {
  const { sheet } = renderSheet();
  mockSheetLayout(sheet());
  dragHandle(by);
  expect(sheet()).toHaveAttribute('data-mode', mode);
});

it('손잡이를 25% 아래까지 끌어 내리면 닫는다', () => {
  const { sheet, onClose } = renderSheet();
  mockSheetLayout(sheet());
  dragHandle(-250);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('끄는 동안은 높이 대신 transform으로 움직이고, 놓으면 인라인 위치를 지운다', () => {
  const { sheet } = renderSheet();
  mockSheetLayout(sheet());
  const handle = dragHandle(100, { release: false });
  // 끌기 시작에 최대 높이(부모의 100%, fullPage)로 한 번 맞추고, 보이는 높이 500px만큼만 올라오게 아래로 민다.
  expect(sheet().style.getPropertyValue('--sheet-height')).toBe('800px');
  expect(sheet().style.transform).toBe('translateY(300px)');
  expect(sheet()).toHaveAttribute('data-dragging', 'true');
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 500 });
  expect(sheet().style.getPropertyValue('--sheet-height')).toBe('');
  expect(sheet().style.transform).toBe('');
  expect(sheet()).not.toHaveAttribute('data-dragging');
});

it('끌다가 취소되면 원래 높이로 돌아간다', () => {
  const { sheet } = renderSheet();
  mockSheetLayout(sheet());
  const handle = dragHandle(100, { release: false });
  fireEvent.pointerCancel(handle, { pointerId: 1 });
  expect(sheet().style.transform).toBe('');
  expect(sheet().style.getPropertyValue('--sheet-height')).toBe('');
  expect(sheet()).toHaveAttribute('data-mode', 'default');
});

it('fullPage를 따로 주지 않아도 끝까지 올리면 페이지로 연다', async () => {
  const user = userEvent.setup();
  render(
    <BottomSheet title="기본 시트" onClose={() => undefined}>
      <p>내용</p>
    </BottomSheet>,
  );
  await expectSheetStages(user, screen.getByRole('region', { name: '기본 시트' }));
});

it('fullPage={false}를 주면 끝까지 올려도 크게에서 멈춘다', async () => {
  const user = userEvent.setup();
  render(
    <BottomSheet title="페이지 없는 시트" onClose={() => undefined} fullPage={false}>
      <p>내용</p>
    </BottomSheet>,
  );
  const sheet = screen.getByRole('region', { name: '페이지 없는 시트' });
  screen.getByRole('button', { name: '상세 패널 높이 조절' }).focus();
  await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
  expect(sheet).toHaveAttribute('data-mode', 'expanded');
});

it('floating은 시트 밖 바로 앞 형제 층(시트 바로 위)에 두어 시트와 함께 움직이고, 페이지로 열면 숨긴다', async () => {
  const user = userEvent.setup();
  const { sheet } = renderSheet({ floating: <button type="button">지도 확대</button> });
  const floating = screen.getByRole('button', { name: '지도 확대' });
  expect(sheet()).not.toContainElement(floating);
  expect(sheet().previousElementSibling).toContainElement(floating);
  screen.getByRole('button', { name: '상세 패널 높이 조절' }).focus();
  await user.keyboard('{ArrowUp}{ArrowUp}');
  expect(sheet()).toHaveAttribute('data-mode', 'full');
  expect(screen.queryByRole('button', { name: '지도 확대' })).not.toBeInTheDocument();
});
