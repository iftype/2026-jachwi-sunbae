import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePropertyCreationForm } from '@/pages/create-property/hooks/usePropertyCreationForm';

const { trackEvent, useCreate, setInitialQuery } = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  useCreate: vi.fn(() => ({ isPending: false })),
  setInitialQuery: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));
vi.mock('@/features/property/api/usePropertyMutations', () => ({ useCreateProperty: useCreate }));
vi.mock('@/pages/create-property/hooks/usePropertyLocation', () => ({
  default: () => ({ locationStatus: 'idle', selectedLocation: {} }),
}));
vi.mock('@/pages/create-property/hooks/useAddressSearch', () => ({ default: () => ({ setInitialQuery }) }));
describe('등록 진입 경로 지표', () => {
  afterEach(() => vi.clearAllMocks());
  it.each(['form', 'map'] as const)('%s 진입은 StrictMode에서도 시작을 한 번 기록한다', (entrypoint) => {
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const routeState =
      entrypoint === 'map'
        ? {
            selectedLocation: {
              latitude: 37,
              longitude: 127,
              address: '테스트 위치',
              roadAddress: null,
              jibunAddress: null,
            },
          }
        : {};
    renderHook(() => usePropertyCreationForm(routeState), { wrapper });
    expect(trackEvent.mock.calls).toEqual([['property_creation_started', { entrypoint }]]);
    expect(useCreate).toHaveBeenCalledWith(entrypoint);
  });
});
