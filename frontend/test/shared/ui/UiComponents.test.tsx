import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { Button, ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import SearchField from '@/shared/ui/search-field/SearchField';
import TextAreaField from '@/shared/ui/text-field/TextAreaField';
import TextField from '@/shared/ui/text-field/TextField';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

describe('공용 UI 컴포넌트', () => {
  it('Button은 처리 중이면 두 번째 누름을 바로 막고 aria-busy로 알리지만, 스피너는 300ms가 지나야 보인다', () => {
    vi.useFakeTimers();
    try {
      const onClick = vi.fn();
      render(
        <Button isLoading loadingLabel="저장 중…" onClick={onClick}>
          저장
        </Button>,
      );
      const button = screen.getByRole('button', { name: '저장' });
      // 빠른 응답에서 버튼이 깜빡이지 않게 모양은 그대로 두되, 요청은 다시 보내지 않는다.
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(299));
      expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Button은 300ms 안에 끝난 요청에는 스피너를 보여 주지 않는다', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <Button isLoading loadingLabel="저장 중…">
          저장
        </Button>,
      );
      act(() => vi.advanceTimersByTime(200));
      rerender(<Button loadingLabel="저장 중…">저장</Button>);
      act(() => vi.runOnlyPendingTimers());
      const button = screen.getByRole('button', { name: '저장' });
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute('aria-busy');
    } finally {
      vi.useRealTimers();
    }
  });

  it('React 19의 ref prop으로 공용 입력 컴포넌트의 DOM에 접근한다', () => {
    const buttonRef = createRef<HTMLButtonElement>();
    const textAreaRef = createRef<HTMLTextAreaElement>();
    const ButtonAndTextArea = () => {
      return (
        <>
          <Button ref={buttonRef}>저장</Button>
          <TextAreaField ref={textAreaRef} label="메모" />
        </>
      );
    };

    render(<ButtonAndTextArea />);

    expect(screen.getByRole('button', { name: '저장' })).toBe(buttonRef.current);
    expect(screen.getByRole('textbox', { name: '메모' })).toBe(textAreaRef.current);
  });

  it('TextField는 라벨과 도움말·오류를 입력 요소에 연결한다', () => {
    render(<TextField label="이름" helpText="구분하기 쉬운 이름" error="이름을 입력해 주세요." />);

    const input = screen.getByRole('textbox', { name: '이름' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('구분하기 쉬운 이름 이름을 입력해 주세요.');
  });

  it('SearchField는 검색어 제출과 초기화를 부모에게 전달한다', async () => {
    const submit = vi.fn();
    const clear = vi.fn();
    const user = userEvent.setup();

    const SearchExample = () => {
      const [value, setValue] = useState('신림');
      return (
        <SearchField label="매물 이름 검색" value={value} onValueChange={setValue} onSubmit={submit} onClear={clear} />
      );
    };

    render(<SearchExample />);
    // 글자가 있으면 오른쪽 한 자리는 x다. 검색은 Enter로 제출한다.
    await user.click(screen.getByRole('textbox', { name: '매물 이름 검색' }));
    await user.keyboard('{Enter}');
    expect(submit).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getByRole('textbox', { name: '매물 이름 검색' })).toHaveValue('');
    expect(clear).toHaveBeenCalledOnce();
    // 비면 같은 자리가 다시 돋보기(검색)가 된다.
    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument();
  });

  it('ButtonLink는 이동 목적지를 명시한다', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/properties">본 방 기록</ButtonLink>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '본 방 기록' })).toHaveAttribute('href', '/properties');
  });

  it('TopNavigation은 제목·보조정보·뒤로가기·우측 슬롯을 함께 표시한다', () => {
    render(
      <MemoryRouter>
        <TopNavigation
          title="매물 정보"
          meta="2개"
          backTo="/properties"
          backLabel="매물 목록으로 돌아가기"
          endSlot={<button type="button">메뉴</button>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('매물 정보')).toBeInTheDocument();
    expect(screen.getByText('2개')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '매물 목록으로 돌아가기' })).toHaveAttribute('href', '/properties');
    expect(screen.getByRole('button', { name: '메뉴' })).toBeInTheDocument();
  });

  it('EmptyState는 문맥에 따라 카드 테두리 없는 상태로 표시할 수 있다', () => {
    render(<EmptyState variant="plain" title="해당 상태의 매물이 없어요." description="다른 상태를 선택해 보세요." />);

    expect(screen.getByText('해당 상태의 매물이 없어요.').closest('section')).toHaveAttribute('data-variant', 'plain');
  });

  it('TextField는 큰 입력칸 크기를 입력칸 묶음에 표시한다', () => {
    render(<TextField label="보증금" fieldSize="large" />);

    expect(screen.getByRole('textbox', { name: '보증금' }).closest('[data-size]')).toHaveAttribute(
      'data-size',
      'large',
    );
  });
});
