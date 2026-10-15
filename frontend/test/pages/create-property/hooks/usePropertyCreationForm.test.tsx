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
  it('공개 탐색에서 넘어온 동네는 주소 선택의 시작점이지 확정된 매물 위치가 아니다', () => {
    const { result } = renderHook(() =>
      usePropertyCreationForm({
        fromExploration: true,
        selectedLocation: {
          latitude: 37.4,
          longitude: 127.1,
          address: '테스트 동네',
          roadAddress: null,
          jibunAddress: null,
        },
      }),
    );
    expect(result.current.hasPresetLocation).toBe(false);
    expect(result.current.nameStep).toBe(3);
    expect(result.current.values.latitude).toBe(37.4);
  });
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
