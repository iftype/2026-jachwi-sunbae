import { render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { expect, it } from 'vitest';

import LazyRouteBoundary from '@/app/router/LazyRouteBoundary';

it('페이지 전환 로딩은 문구 대신 원형 진행 표시를 사용한다', () => {
  const PendingPage = lazy(() => new Promise<{ default: () => null }>(() => {}));
  render(
    <LazyRouteBoundary>
      <PendingPage />
    </LazyRouteBoundary>,
  );
  expect(screen.getByRole('progressbar', { name: '화면을 불러오는 중이에요.' })).toBeInTheDocument();
  expect(screen.queryByText('화면을 불러오는 중이에요.')).not.toBeInTheDocument();
});
