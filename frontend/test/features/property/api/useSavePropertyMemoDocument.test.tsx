import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSavePropertyMemoDocument } from '@/features/property/api/usePropertyMutations';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

const { saveMemo, trackEvent } = vi.hoisted(() => ({ saveMemo: vi.fn(), trackEvent: vi.fn() }));
vi.mock('@/features/property/api/propertyApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/property/api/propertyApi')>()),
  savePropertyMemoDocument: saveMemo,
}));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));
const setup = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>{children}</PublicConfigProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useSavePropertyMemoDocument(42), { wrapper });
};
describe('메모 저장 지표', () => {
  afterEach(() => vi.resetAllMocks());
  it('저장 성공 뒤에 한 번 기록하고 메모 원문은 보내지 않는다', async () => {
    saveMemo.mockResolvedValue({ freeMemo: '사용자 입력' });
    const { result } = setup();
    await act(async () => {
      await result.current.mutateAsync({ freeMemo: '사용자 입력' });
    });
    expect(trackEvent.mock.calls).toEqual([['property_memo_saved', { property_id: 42 }]]);
  });
  it('실패한 저장을 성공으로 집계하지 않는다', async () => {
    saveMemo.mockRejectedValue(new Error('request failed'));
    const { result } = setup();
    await act(async () => {
      await expect(result.current.mutateAsync({ freeMemo: '사용자 입력' })).rejects.toThrow();
    });
    expect(trackEvent.mock.calls).toEqual([['property_memo_save_failed', { property_id: 42, error_kind: 'request' }]]);
  });
});
