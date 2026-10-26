import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { propertyChecklistHandlers } from '@/app/mocks/handlers/propertyChecklistHandlers';
import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import PropertyDetailPage from '@/pages/property-detail/PropertyDetailPage';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

beforeEach(() => {
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(...propertyHandlers, ...propertyChecklistHandlers);
});
afterEach(() => {
  resetAuthenticationForTests();
  queryClient.clear();
  sessionStorage.clear();
});

const renderDetail = (search = '') => {
  const router = createMemoryRouter([{ path: '/properties/:propertyId', element: <PropertyDetailPage /> }], {
    initialEntries: [{ pathname: '/properties/10', search, state: { returnTo: '/properties' } }],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <RouterProvider router={router} />
      </PublicConfigProvider>
    </QueryClientProvider>,
  );
  return router;
};

it('주소에 체크리스트 탭이 있으면 체크리스트 탭으로 연다', async () => {
  renderDetail('?tab=checklist');
  expect(await screen.findByRole('tab', { name: '체크리스트' })).toHaveAttribute('aria-selected', 'true');
});

it('고른 탭을 들어온 화면 정보와 함께 주소에 남긴다', async () => {
  const user = userEvent.setup();
  const router = renderDetail();
  await user.click(await screen.findByRole('tab', { name: '체크리스트' }));

  expect(router.state.location.search).toBe('?tab=checklist');
  expect(router.state.location.state).toEqual({ returnTo: '/properties' });
  expect(router.state.historyAction).toBe('REPLACE');

  await user.click(screen.getByRole('tab', { name: '정보' }));
  expect(router.state.location.search).toBe('?tab=details');
});

it('주소에 탭이 없으면 마지막으로 본 탭으로 연다', async () => {
  const user = userEvent.setup();
  renderDetail();
  await user.click(await screen.findByRole('tab', { name: '체크리스트' }));
  cleanup();

  renderDetail();
  expect(await screen.findByRole('tab', { name: '체크리스트' })).toHaveAttribute('aria-selected', 'true');
});
