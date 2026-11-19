import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';

import { propertySummaryFixture } from '@/app/mocks/fixtures/propertyFixtures';
import RecordsSelectedSheet from '@/pages/design-records/mobile/RecordsSelectedSheet';
import { recordPresentation } from '@/pages/design-records/model/recordPresentation';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { expectSheetStages } from '../../../shared/ui/bottom-sheet/sheetStages';

it('지도에서 고른 매물 시트는 끝까지 끌어 올리면 페이지로 열리고 네 단계를 오간다', async () => {
  const user = userEvent.setup();
  render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecordsSelectedSheet
            records={[recordPresentation(propertySummaryFixture as Parameters<typeof recordPresentation>[0])]}
            onClose={vi.fn()}
            onNotice={vi.fn()}
            collapsed={false}
            onCollapsedChange={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>,
  );
  await expectSheetStages(user, screen.getByRole('region', { name: '선택한 매물' }));
});

it('시트를 접어도 선택을 닫지 않고 접힘 선호를 알리며, 접어 둔 채로 열 수 있다', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onCollapsedChange = vi.fn();
  const renderSheet = (collapsed: boolean) => (
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecordsSelectedSheet
            records={[recordPresentation(propertySummaryFixture as Parameters<typeof recordPresentation>[0])]}
            onClose={onClose}
            onNotice={vi.fn()}
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>
  );
  const { unmount } = render(renderSheet(false));
  await user.click(screen.getByRole('button', { name: '시트 접기' }));
  expect(screen.getByRole('region', { name: '선택한 매물' }).dataset.mode).toBe('peek');
  expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
  expect(onClose).not.toHaveBeenCalled();
  unmount();
  render(renderSheet(true));
  expect(screen.getByRole('region', { name: '선택한 매물' }).dataset.mode).toBe('peek');
  await user.click(screen.getByRole('button', { name: '시트 펼치기' }));
  expect(screen.getByRole('region', { name: '선택한 매물' }).dataset.mode).toBe('default');
  expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
});
