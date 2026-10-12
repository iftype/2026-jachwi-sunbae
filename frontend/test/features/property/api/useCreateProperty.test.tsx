import type { InfiniteData } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PropertyInputDto } from '@/features/property/api/dtos/PropertyDto';
import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import { useCreateProperty } from '@/features/property/api/usePropertyMutations';
import type { PropertyPage } from '@/features/property/model/Property';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
const { createProperty, trackEvent } = vi.hoisted(() => ({ createProperty: vi.fn(), trackEvent: vi.fn() }));
vi.mock('@/features/property/api/propertyApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/property/api/propertyApi')>()),
  createProperty,
}));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));
const input: PropertyInputDto = {
  name: '매물',
  depositAmount: 0,
  monthlyRentAmount: 10000,
  discoverySource: null,
  address: null,
  latitude: null,
  longitude: null,
  availableMoveInDate: null,
  maintenanceFeeAmount: null,
  visitScheduledAt: null,
  roomOptions: [],
  utilityOptions: [],
};
const setup = (total?: number, entrypoint: 'form' | 'map' = 'form') => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  if (total !== undefined)
    client.setQueryData<InfiniteData<PropertyPage>>(propertyQueryKeys.list(''), {
      pages: [{ content: [], page: 0, size: 20, totalElements: total, totalPages: 1, hasNext: false }],
      pageParams: [0],
    });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>{children}</PublicConfigProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useCreateProperty(entrypoint), { wrapper });
};
describe('매물 생성 공통 이벤트', () => {
  afterEach(() => vi.resetAllMocks());
  it.each([0, 2])('생성 성공을 경로에 관계없이 한 번 수집한다 (기존 %i개)', async (total) => {
    createProperty.mockResolvedValue({ propertyId: 42 });
    const { result } = setup(total);
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(trackEvent.mock.calls).toEqual([
      ['property_creation_submitted', { entrypoint: 'form' }],
      ['property_created', { entrypoint: 'form', property_id: 42, first_property: total === 0 }],
    ]);
  });
  it('목록을 모르면 첫 매물이라고 추정하지 않는다', async () => {
    createProperty.mockResolvedValue({ propertyId: 42 });
    const { result } = setup();
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(trackEvent).toHaveBeenLastCalledWith('property_created', { entrypoint: 'form', property_id: 42 });
  });
  it('생성 실패는 실패 이벤트만 보내고 성공 이벤트는 보내지 않는다', async () => {
    createProperty.mockRejectedValue(new Error('server error'));
    const { result } = setup();
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow('server error');
    });
    expect(trackEvent.mock.calls).toEqual([
      ['property_creation_submitted', { entrypoint: 'form' }],
      ['property_creation_failed', { entrypoint: 'form', error_kind: 'request' }],
    ]);
  });
  it('지도 진입도 제출과 저장 성공에 같은 진입 경로를 보낸다', async () => {
    createProperty.mockResolvedValue({ propertyId: 42 });
    const { result } = setup(undefined, 'map');
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(trackEvent.mock.calls).toEqual([
      ['property_creation_submitted', { entrypoint: 'map' }],
      ['property_created', { entrypoint: 'map', property_id: 42 }],
    ]);
  });
});
