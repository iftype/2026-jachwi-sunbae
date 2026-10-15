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
