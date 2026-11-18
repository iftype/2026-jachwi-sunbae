import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import SearchField from '@/shared/ui/search-field/SearchField';

it('검색어 수정과 지우기는 화면 부모에게만 알린다', async () => {
  const change = vi.fn();
  render(<SearchField label="주소 검색" value="서울" onValueChange={change} onSubmit={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
  expect(change).toHaveBeenCalledWith('');
});

it.each([true, false])(
  'form 사용 여부 %s: 입력 Enter는 검색하고 한글 조합 중 Enter는 검색하지 않는다',
  (renderAsForm) => {
    const submit = vi.fn();
    const back = vi.fn();
    render(
      <SearchField
        label="주소 검색"
        value="서울"
        onValueChange={vi.fn()}
        onSubmit={submit}
        onBack={back}
        renderAsForm={renderAsForm}
      />,
    );
    const input = screen.getByRole('textbox', { name: '주소 검색' });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(submit).not.toHaveBeenCalled();
    if (renderAsForm) fireEvent.submit(screen.getByRole('search'));
    else fireEvent.keyDown(input, { key: 'Enter' });
    expect(submit).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole('button', { name: '뒤로 가기' }), { key: 'Enter' });
    expect(submit).toHaveBeenCalledOnce();
  },
);

it('비활성화 상태에서는 검색하지 않는다', () => {
  const submit = vi.fn();
  render(<SearchField label="주소 검색" value="서울" disabled onValueChange={vi.fn()} onSubmit={submit} />);
  fireEvent.submit(screen.getByRole('search'));
  expect(submit).not.toHaveBeenCalled();
});

it('돋보기는 입력 오른쪽 끝에서 검색을 실행한다', async () => {
  const submit = vi.fn();
  render(<SearchField label="장소" value="" onValueChange={vi.fn()} onSubmit={submit} showSubmitButton={false} />);
  const button = screen.getByRole('button', { name: '검색' });
  expect(button).toBe(screen.getByRole('search').lastElementChild);
  await userEvent.click(button);
  expect(submit).toHaveBeenCalledOnce();
});

it('제출 버튼이 없는 검색창은 입력을 시작하면 오른쪽 돋보기를 치우고 왼쪽에 돋보기를 보인다', () => {
  const { rerender } = render(
    <SearchField label="장소" value="" onValueChange={vi.fn()} onSubmit={vi.fn()} showSubmitButton={false} />,
  );
  const search = screen.getByRole('search');
  expect(search).toHaveAttribute('data-typing', 'false');
  expect(search.querySelector('[data-role="typing-icon"]')).not.toBeNull();
  rerender(
    <SearchField label="장소" value="서울" onValueChange={vi.fn()} onSubmit={vi.fn()} showSubmitButton={false} />,
  );
  expect(screen.getByRole('search')).toHaveAttribute('data-typing', 'true');
});

it('제출 버튼이 있는 검색창에는 입력 중 왼쪽 돋보기를 두지 않는다', () => {
  render(<SearchField label="주소 검색" value="서울" onValueChange={vi.fn()} onSubmit={vi.fn()} />);
  expect(screen.getByRole('search').querySelector('[data-role="typing-icon"]')).toBeNull();
});
