import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';

import AreaActionCard from '@/pages/neighborhood-preview/ui/area-action-card/AreaActionCard';

const renderCard = (link: { href: string } | { to: string }) =>
  render(
    <MemoryRouter>
      <AreaActionCard
        icon={<img src="/icon.png" alt="" />}
        title="현재 매물 확인하기"
        description="다방에서 논현1동 원·투룸 보기"
        link={link}
      />
    </MemoryRouter>,
  );

it('외부 주소 카드는 전체가 새 탭 링크이고, 글이 왼쪽 아이콘이 오른쪽에 오며 따로 외부 링크 아이콘을 두지 않는다', () => {
  renderCard({ href: 'https://www.dabangapp.com/' });
  const card = screen.getByRole('link', { name: /현재 매물 확인하기/ });
  expect(card).toHaveAttribute('target', '_blank');
  expect(card).toHaveAttribute('rel', 'noopener noreferrer');
  expect(card.querySelector('svg')).toBeNull();
  const [text, icon] = Array.from(card.children);
  expect(text).toHaveTextContent('현재 매물 확인하기다방에서 논현1동 원·투룸 보기');
  expect(icon.querySelector('img')).not.toBeNull();
});

it('서비스 안 경로 카드는 라우터 링크로 연다', () => {
  renderCard({ to: '/neighborhoods/areas/1/nearby' });
  const card = screen.getByRole('link', { name: /현재 매물 확인하기/ });
  expect(card).toHaveAttribute('href', '/neighborhoods/areas/1/nearby');
  expect(card).not.toHaveAttribute('target');
});
