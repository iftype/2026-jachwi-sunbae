import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import type { CommuteArea } from '@/features/map/api/commuteApi';
import {
  FALLBACK_RENT_CENTER,
  missingCodes,
  pickRents,
  PRIMARY_RENT_CENTER,
  rentTableQueryKey,
  toRentTable,
  useBookmarkedRegionRents,
} from '@/features/map/api/useBookmarkedRegionRents';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../../server';

type RentRow = { code: string; monthly: number | null };

const areaOf = ({ code, monthly }: RentRow) => ({
  adminDongCode: code,
  commuteMinutes: 10,
  stations: [
    { latitude: 37.5, longitude: 127, stopId: `RS_${code}`, stopName: '역', travelMinutes: 10, direction: null },
  ],
  monthlyRentKrw: monthly,
  depositKrw: monthly === null ? null : 10_000_000,
  transactionCount: monthly === null ? null : 572,
  legalDongNames: [],
});

/** 위도별로 다른 동 목록을 돌려주고, 받은 요청의 위도를 모은다. */
const serveRents = (byLatitude: Record<string, RentRow[]>) => {
  const calls: string[] = [];
  server.use(
    http.get('*/api/commute-areas/with-rents', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const latitude = params.get('latitude') ?? '';
      calls.push(latitude);
      const areas = (byLatitude[latitude] ?? []).map(areaOf);
      return HttpResponse.json({
        code: 'SUCCESS',
        message: '',
        data: { maxMinutes: 60, areaCount: areas.length, rentStartDate: null, rentEndDate: null, areas },
      });
    }),
  );
  return calls;
};

const setup = (initial: { codes: string[]; enabled: boolean }, client = new QueryClient()) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost', commuteDataSource: 'mock' }}>
        {children}
      </PublicConfigProvider>
    </QueryClientProvider>
  );
  const view = renderHook(({ codes, enabled }) => useBookmarkedRegionRents(codes, enabled), {
    wrapper,
    initialProps: initial,
  });
  return { ...view, client };
};

const primary = String(PRIMARY_RENT_CENTER.latitude);
const fallback = String(FALLBACK_RENT_CENTER.latitude);
const rent = { monthlyRentKrw: 700_000, depositKrw: 10_000_000, transactionCount: 572 };

describe('시세 표 순수 함수', () => {
  it('통근 결과를 동 코드별 시세 표로 줄이고, 시세가 없는 동은 null로 둔다', () => {
    const areas = [
      { adminDongCode: '11230640', rent: { ...rent, legalDongNames: ['역삼동'] } },
      { adminDongCode: '11140550', rent: null },
    ] as unknown as CommuteArea[];
    expect(toRentTable(areas)).toEqual({ '11230640': rent, '11140550': null });
  });

  it('찜한 코드만 고르고, 표에 없는 코드는 빠진 코드로 남는다', () => {
    const table = { '11230640': rent, '11140550': null, '11110515': rent };
    expect(pickRents(table, ['11140550', '41135550'])).toEqual({ '11140550': null });
    expect(missingCodes(['11140550', '41135550'], table)).toEqual(['41135550']);
  });

  it('캐시 키는 고정 좌표와 API 주소로 정해 다른 화면과 나눠 쓴다', () => {
    expect(rentTableQueryKey('http://localhost', PRIMARY_RENT_CENTER)).toEqual([
      'commute-rents-all',
      'http://localhost',
      37.5665,
      126.978,
    ]);
  });
});

describe('useBookmarkedRegionRents', () => {
  it('찜한 동네가 없으면 시세를 받지 않는다', async () => {
    const calls = serveRents({ [primary]: [{ code: '11230640', monthly: 700_000 }] });
    const { result } = setup({ codes: [], enabled: true });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toEqual([]);
    expect(result.current).toEqual({});
  });

  it('꺼 두면 찜한 동네가 있어도 받지 않는다', async () => {
    const calls = serveRents({ [primary]: [{ code: '11230640', monthly: 700_000 }] });
    setup({ codes: ['11230640'], enabled: false });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toEqual([]);
  });

  it('고정 좌표로 받은 응답에서 찜한 동만 골라 넘기고, 거래가 적은 동은 null이다', async () => {
    const calls = serveRents({
      [primary]: [
        { code: '11230640', monthly: 700_000 },
        { code: '11140550', monthly: null },
        { code: '11110515', monthly: 500_000 },
      ],
    });
    const { result, client } = setup({ codes: ['11230640', '11140550'], enabled: true });
    await waitFor(() => expect(result.current).toEqual({ '11230640': rent, '11140550': null }));
    expect(calls).toEqual([primary]);
    // 캐시에는 응답 전체를 작은 표로 둬, 다른 찜 목록도 다시 받지 않고 고른다.
    expect(client.getQueryData(rentTableQueryKey('http://localhost', PRIMARY_RENT_CENTER))).toEqual({
      '11230640': rent,
      '11140550': null,
      '11110515': { ...rent, monthlyRentKrw: 500_000 },
    });
  });

  it('첫 응답에 없는 동이 있을 때만 다른 중심으로 한 번 더 받는다', async () => {
    const calls = serveRents({
      [primary]: [{ code: '11230640', monthly: 700_000 }],
      [fallback]: [{ code: '41135550', monthly: 700_000 }],
    });
    const { result } = setup({ codes: ['11230640', '41135550'], enabled: true });
    await waitFor(() => expect(result.current).toEqual({ '11230640': rent, '41135550': rent }));
    expect(calls).toEqual([primary, fallback]);
  });

  it('동네 찾기 결과가 캐시에 있으면 그 시세를 쓰고 따로 받지 않는다', async () => {
    const calls = serveRents({ [primary]: [{ code: '11230640', monthly: 700_000 }] });
    const client = new QueryClient();
    client.setQueryData(['commute-areas', 'http://localhost', '', 37.5, 127, 40, 2], {
      maxMinutes: 40,
      areaCount: 1,
      rentPeriod: null,
      areas: [{ adminDongCode: '11230640', rent: { ...rent, legalDongNames: [] } }],
    });
    const { result } = setup({ codes: ['11230640'], enabled: true }, client);
    expect(result.current).toEqual({ '11230640': rent });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toEqual([]);
  });

  it('받지 못하면 시세 없이 빈 표를 넘긴다', async () => {
    server.use(http.get('*/api/commute-areas/with-rents', () => HttpResponse.json({}, { status: 500 })));
    const { result } = setup({ codes: ['11230640'], enabled: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toEqual({});
  });
});
