import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import ChecklistBundleCard from '@/features/checklist/ui/checklist-bundle-card/ChecklistBundleCard';

const renderCard = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ChecklistBundleCard', () => {
  it('고르는 카드는 제목, 부제, 뱃지와 선택 상태를 보여 주고 누르면 선택한다', async () => {
    const onSelect = vi.fn();
    renderCard(
      <ChecklistBundleCard
        kind="option"
        title="원룸 현장 확인"
        description="12개 항목"
        badge="현재"
        name="x"
        value="1"
        checked
        onSelect={onSelect}
      />,
    );
    const radio = screen.getByRole('checkbox', { name: /원룸 현장 확인/ });
    expect(radio).toBeChecked();
    expect(screen.getByText('12개 항목')).toBeInTheDocument();
    expect(screen.getByText('현재')).toBeInTheDocument();
    await userEvent.setup().click(radio);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('관리 목록 카드는 주소로 가는 링크이고 열려 있는 카드를 표시한다', () => {
    renderCard(
      <ChecklistBundleCard kind="link" to="/checklists/3" title="야간 방문용" description="5개 항목" isCurrent />,
    );
    const link = screen.getByRole('link', { name: /야간 방문용/ });
    expect(link).toHaveAttribute('href', '/checklists/3');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('읽기 전용 카드는 누를 곳 없이 글만 보여 준다', () => {
    renderCard(<ChecklistBundleCard kind="static" title="자취선배 기본 체크리스트" description="필수 항목" />);
    expect(screen.getByText('자취선배 기본 체크리스트')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('교체와 관리 카드는 같은 카드 클래스를 쓴다', () => {
    const { container } = renderCard(
      <>
        <ChecklistBundleCard
          kind="option"
          title="a"
          description="b"
          name="x"
          value="1"
          checked={false}
          onSelect={vi.fn()}
        />
        <ChecklistBundleCard kind="link" to="/c" title="a" description="b" />
        <ChecklistBundleCard kind="static" title="a" description="b" />
      </>,
    );
    const cards = [...container.querySelectorAll('[class*="ChecklistBundleCard-card"]')];
    expect(cards).toHaveLength(3);
  });
});
