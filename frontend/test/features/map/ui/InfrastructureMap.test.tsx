import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { FacilityFocusProvider } from '@/features/map/hooks/useFacilityFocus';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import InfrastructureMap from '@/features/map/ui/infrastructure-panel/InfrastructureMap';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

vi.mock('@/features/map/ui/map-canvas/MapCanvasSurface', () => ({ default: () => <div aria-label="예시 지도" /> }));

afterEach(() => queryClient.clear());

const property = {
  id: 'my-property:7',
  latitude: 37.5,
  longitude: 127.03,
  label: '내 매물',
  tone: 'property' as const,
};
const renderMap = (selectedMarkerId: string | null) =>
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <FacilityFocusProvider>
          <InfrastructureMap
            mapProps={{ center: property, markers: [property], selectedMarkerId } as MapCanvasProps}
            open
            onClose={() => undefined}
          />
        </FacilityFocusProvider>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );

it('매물을 골랐을 때만 시설 분류 카드를 지도에 함께 보인다', () => {
  const { unmount } = renderMap('my-property:7');
  expect(screen.getByRole('complementary', { name: '지도 시설 카테고리' })).toBeInTheDocument();
  unmount();
  renderMap(null);
  expect(screen.queryByRole('complementary', { name: '지도 시설 카테고리' })).not.toBeInTheDocument();
});
