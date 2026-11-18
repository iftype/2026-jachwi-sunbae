import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

it('돋보기와 x는 오른쪽 끝 한 자리를 번갈아 쓴다: 비면 돋보기로 검색하고, 글자가 있으면 x로 지운다', async () => {
  const submit = vi.fn();
  const clear = vi.fn();
  const Example = () => {
    const [value, setValue] = useState('');
    return (
      <SearchField
        label="장소"
        value={value}
        onValueChange={setValue}
        onSubmit={submit}
        onClear={clear}
        showSubmitButton={false}
      />
    );
  };
  render(<Example />);
  const search = screen.getByRole('search');
  // 비어 있을 때: 돋보기가 입력 오른쪽 끝(마지막 자식)에 있고 눌러서 검색한다.
  const magnifier = screen.getByRole('button', { name: '검색' });
  expect(magnifier).toBe(search.lastElementChild);
  await userEvent.click(magnifier);
  expect(submit).toHaveBeenCalledOnce();
  // 글자를 입력하면 같은 자리가 x로 바뀐다. 돋보기와 x가 나란히 있지 않다.
  const input = screen.getByRole('textbox', { name: '장소' });
  await userEvent.type(input, '서울');
  expect(screen.queryByRole('button', { name: '검색' })).not.toBeInTheDocument();
  const x = screen.getByRole('button', { name: '검색어 지우기' });
  expect(x).toBe(search.lastElementChild);
  // x를 누르면 지우고 포커스는 입력 칸에 남으며, 같은 자리가 다시 돋보기가 된다.
  await userEvent.click(x);
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
  expect(clear).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: '검색' })).toBe(search.lastElementChild);
});
