import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { success } from '@/app/mocks/mockStore';
import PropertyNearbyPreview from '@/pages/property-detail/ui/property-nearby-preview/PropertyNearbyPreview';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

// 지도에 올린 마커 이름만 보인다.
vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: ({ markers }: MapCanvasProps) => (
    <ul aria-label="주변 지도 마커">
      {markers?.map((marker) => (
        <li key={marker.id}>{marker.label}</li>
      ))}
    </ul>
  ),
}));

const CENTER = { latitude: 37.4841, longitude: 126.9291 };

const place = (providerPlaceId: string, name: string, category: string, distanceMeters: number) => ({
  providerPlaceId,
  name,
  category,
  address: '서울 관악구',
  latitude: CENTER.latitude,
  longitude: CENTER.longitude,
  distanceMeters,
});

beforeEach(() => {
  server.use(
    http.get('*/api/maps/nearby', () =>
      success({
        center: CENTER,
        radius: 500,
        counts: { HOSPITAL: 1, SCHOOL: 1, CONVENIENCE: 2, AGENCY: 0 },
        places: [
          place('c1', '신림 편의점', 'CONVENIENCE', 120),
          place('c2', '역앞 편의점', 'CONVENIENCE', 300),
          place('h1', '신림 의원', 'HOSPITAL', 250),
          place('school1', '신림 학교', 'SCHOOL', 150),
        ],
      }),
    ),
    http.get('*/api/maps/bus-stops', () =>
      success({
        center: CENTER,
        radius: 500,
        count: 1,
        busStops: [{ nodeId: 's1', name: '신림역 정류장', ...CENTER, distanceMeters: 90 }],
      }),
    ),
  );
});
afterEach(() => queryClient.clear());

const renderPreview = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <PropertyNearbyPreview propertyId={10} {...CENTER} />
      </PublicConfigProvider>
    </QueryClientProvider>,
  );

it('학교를 제외한 500m 안 시설 수와 거리를 범례와 지도에 보인다', async () => {
  renderPreview();

  expect(await screen.findByLabelText('500m 안 시설 4곳')).toHaveTextContent('4');
  const legend = within(screen.getByRole('list', { name: '500m 안 시설 수' }));
  expect(legend.getByRole('button', { name: /편의점/ })).toHaveTextContent('편의점2120m');
  expect(legend.getByRole('button', { name: /교통/ })).toHaveTextContent('교통190m');
  // 없는 시설은 누를 수 없다.
  expect(legend.queryByRole('button', { name: /학교/ })).not.toBeInTheDocument();
  expect(legend.getByRole('button', { name: /중개/ })).toBeDisabled();

  const markers = within(screen.getByRole('list', { name: '주변 지도 마커' }));
  expect(markers.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    '신림 편의점',
    '역앞 편의점',
    '신림 의원',
    '신림역 정류장',
    '이 매물',
  ]);
});

it('범례에서 시설을 누르면 그 시설 점만 남기고, 다시 누르거나 초기화하면 모두 되돌린다', async () => {
  const user = userEvent.setup();
  renderPreview();
  const legend = within(await screen.findByRole('list', { name: '500m 안 시설 수' }));
  const markers = () =>
    within(screen.getByRole('list', { name: '주변 지도 마커' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent);

  await user.click(legend.getByRole('button', { name: /병원/ }));
  expect(legend.getByRole('button', { name: /병원/ })).toHaveAttribute('aria-pressed', 'true');
  expect(markers()).toEqual(['신림 의원', '이 매물']);

  await user.click(legend.getByRole('button', { name: /병원/ }));
  expect(markers()).toHaveLength(5);

  await user.click(legend.getByRole('button', { name: /편의점/ }));
  expect(markers()).toEqual(['신림 편의점', '역앞 편의점', '이 매물']);
  await user.click(screen.getByRole('button', { name: '초기화' }));
  expect(markers()).toHaveLength(5);
  expect(screen.queryByRole('button', { name: '초기화' })).not.toBeInTheDocument();
});
