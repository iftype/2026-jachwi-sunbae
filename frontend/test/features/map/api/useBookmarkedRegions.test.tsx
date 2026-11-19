import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { expect, it } from 'vitest';

import { useBookmarkedRegions } from '@/features/map/api/useBookmarkedRegions';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../../server';

const square = (latitude: number) => [
  [
    [
      { lat: latitude, lng: 127 },
      { lat: latitude + 0.01, lng: 127 },
      { lat: latitude, lng: 127.01 },
      { lat: latitude, lng: 127 },
    ].map((point) => [point.lng, point.lat]),
  ],
];

const serveBoundaries = (codes: string[]) =>
  server.use(
    http.get('*/boundaries/manifest.json', () =>
      HttpResponse.json({ version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' }),
    ),
    http.get('*/boundaries/:filename', () =>
      HttpResponse.json({
        type: 'FeatureCollection',
        features: codes.map((code, index) => ({
          type: 'Feature',
          properties: { code, name: `동${code}`, fullName: `서울 동${code}`, baseDate: '20250630' },
          geometry: { type: 'MultiPolygon', coordinates: square(37.5 + index * 0.1) },
        })),
      }),
    ),
  );

const setup = (initial: { codes: string[]; enabled: boolean }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost', commuteDataSource: 'mock' }}>
        {children}
      </PublicConfigProvider>
    </QueryClientProvider>
  );
  return renderHook(({ codes, enabled }) => useBookmarkedRegions(codes, enabled), { wrapper, initialProps: initial });
};

it('꺼 둔 채 찜한 동네가 있다가 켜면 그 동네들의 영역이 나온다', async () => {
  serveBoundaries(['11230640', '11140550']);
  const { result, rerender } = setup({ codes: ['11230640', '11140550'], enabled: false });
  expect(result.current).toEqual([]);
  rerender({ codes: ['11230640', '11140550'], enabled: true });
  await waitFor(() => expect(result.current.map((region) => region.id)).toEqual(['11230640', '11140550']));
});

it('켜 둔 채 동네를 더 찜해도 이미 그린 영역은 사라지지 않고 새 영역이 더해진다', async () => {
  serveBoundaries(['11230640', '11140550']);
  const { result, rerender } = setup({ codes: ['11230640'], enabled: true });
  await waitFor(() => expect(result.current.map((region) => region.id)).toEqual(['11230640']));
  rerender({ codes: ['11140550', '11230640'], enabled: true });
  // 새 영역을 받는 동안에도 먼저 그린 영역은 그대로 남는다.
  expect(result.current.map((region) => region.id)).toContain('11230640');
  await waitFor(() => expect(result.current.map((region) => region.id)).toEqual(['11140550', '11230640']));
});
