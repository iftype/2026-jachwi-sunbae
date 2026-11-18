import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import Tooltip from '@/shared/ui/tooltip/Tooltip';

it('설명과 앵커를 연결하고 Escape로 닫는다', async () => {
  render(
    <Tooltip content="지도를 눌러 기록해요">
      <button>지도</button>
    </Tooltip>,
  );
  const bubble = screen.getByRole('tooltip');
  expect(screen.getByRole('button').parentElement).toHaveAttribute('aria-describedby', bubble.id);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
it('바깥을 누르거나 앵커를 누르면 닫히고 원래 버튼 동작은 이어진다', async () => {
  render(
    <>
      <Tooltip content="도움말" placement="bottom">
        <button>앵커</button>
      </Tooltip>
      <button>바깥</button>
    </>,
  );
  expect(screen.getByRole('tooltip')).toHaveAttribute('data-placement', 'bottom');
  await userEvent.click(screen.getByRole('button', { name: '바깥' }));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
