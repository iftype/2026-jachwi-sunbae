import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

import type { AdminBoundaries } from '@/features/map/api/adminBoundaryApi';
import { fetchAdminBoundaries } from '@/features/map/api/adminBoundaryApi';
import type { CommuteArea } from '@/features/map/api/commuteApi';
import { fetchCommuteAreas } from '@/features/map/api/commuteApi';
import { useCommuteAreas } from '@/features/map/api/useCommuteAreas';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

vi.mock('@/features/map/api/commuteApi', () => ({ fetchCommuteAreas: vi.fn() }));
vi.mock('@/features/map/api/adminBoundaryApi', () => ({
  fetchBoundaryManifest: async () => ({
    version: '20250630',
    file: 'admin-dongs.20250630.000000000000.geojson',
    files: { '11': 'seoul.geojson', '23': 'incheon.geojson', '31': 'gyeonggi.geojson' },
  }),
  selectBoundaryFiles: (manifest: { version: string; files: Record<string, string> }, codes: string[]) =>
    [...new Set(codes.map((code) => code.slice(0, 2)))].map((region) => ({
      version: manifest.version,
      file: manifest.files[region],
    })),
  fetchAdminBoundaries: vi.fn(),
}));

const area = (adminDongCode: string): CommuteArea => ({
  adminDongCode,
  name: adminDongCode,
  fullName: adminDongCode,
  commuteMinutes: 10,
  stations: [],
  center: { latitude: 0, longitude: 0 },
  polygons: [],
});
const boundary = (name: string) => ({
  name,
  fullName: `시 ${name}`,
  center: { latitude: 37, longitude: 127 },
  polygons: [[[{ latitude: 37, longitude: 127 }]]],
  simplifiedPolygons: { overview: [], medium: [] },
});

it('결과 행정동의 시도 경계 파일만 받아 이름·중심·경계를 합친다', async () => {
  vi.mocked(fetchCommuteAreas).mockResolvedValue({
    maxMinutes: 60,
    areaCount: 2,
    areas: [area('11230640'), area('23010510')],
  });
  vi.mocked(fetchAdminBoundaries).mockImplementation(async ({ file }): Promise<AdminBoundaries> =>
    file === 'seoul.geojson' ? { '11230640': boundary('역삼1동') } : { '23010510': boundary('신포동') },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost', commuteDataSource: 'mock' }}>
        {children}
      </PublicConfigProvider>
    </QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () =>
      useCommuteAreas({
        destination: { latitude: 37, longitude: 127 },
        maxMinutes: 60,
        maxTransfers: 2,
        enabled: true,
      }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(
    vi
      .mocked(fetchAdminBoundaries)
      .mock.calls.map(([file]) => file.file)
      .sort(),
  ).toEqual(['incheon.geojson', 'seoul.geojson']);
  expect(result.current.data?.areas.map((item) => item.name)).toEqual(['역삼1동', '신포동']);
  expect(result.current.data?.areas[0].center).toEqual({ latitude: 37, longitude: 127 });
  expect(result.current.data?.areas[0].simplifiedPolygons).toEqual({ overview: [], medium: [] });
  unmount();
  client.clear();
});

it('경계 파일에 없는 동은 코드 이름과 안내 문구, 원래 중심, 빈 경계로 남긴다', async () => {
  vi.mocked(fetchCommuteAreas).mockResolvedValue({
    maxMinutes: 60,
    areaCount: 1,
    areas: [{ ...area('11999999'), center: { latitude: 37.1, longitude: 127.1 } }],
  });
  vi.mocked(fetchAdminBoundaries).mockResolvedValue({});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost', commuteDataSource: 'mock' }}>
        {children}
      </PublicConfigProvider>
    </QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () =>
      useCommuteAreas({
        destination: { latitude: 37, longitude: 127 },
        maxMinutes: 60,
        maxTransfers: 2,
        enabled: true,
      }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.areas[0]).toMatchObject({
    name: '11999999',
    fullName: '경계 정보가 없는 동네',
    center: { latitude: 37.1, longitude: 127.1 },
    polygons: [],
    simplifiedPolygons: undefined,
  });
  unmount();
  client.clear();
});
