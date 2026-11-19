import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';

import { propertySummaryFixture } from '@/app/mocks/fixtures/propertyFixtures';
import usePropertyRoute from '@/pages/neighborhood-preview/hooks/usePropertyRoute';
import type { MyPropertyRow } from '@/pages/neighborhood-preview/model/myProperty';
import FinderPropertyPanel from '@/pages/neighborhood-preview/ui/finder-property-panel/FinderPropertyPanel';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../../server';

const destination = { latitude: 37.55, longitude: 127.0, name: '회사', address: '서울 중구' };

const property = (commute: MyPropertyRow['commute']): MyPropertyRow => ({
  propertyId: 7,
  name: '역삼동 원룸',
  depositAmount: 500,
  monthlyRentAmount: 50,
  address: '서울 강남구 역삼동',
  latitude: 37.5,
  longitude: 127.0,
  commute,
  representativePhoto: null,
  summary: {
    ...propertySummaryFixture,
    propertyId: 7,
    name: '역삼동 원룸',
    discoverySource: { type: 'URL', value: 'https://example.com/listings/7' },
  },
});

/** 시트가 쓰는 대로, 통근 시간이 나온 내 매물만 노선을 부른다. */
const Panel = ({ row, onOpenDetail }: { row: MyPropertyRow; onOpenDetail?: () => void }) => {
  const reachable = row.isPreview !== true && row.commute?.status === 'REACHABLE';
  const route = usePropertyRoute({ destination }, reachable ? row.propertyId : null);
  return (
    <FinderPropertyPanel
      property={row}
      destination={destination}
      route={route}
      commuteMaxMinutes={60}
      onOpenDetail={onOpenDetail}
      onDeleted={() => undefined}
    />
  );
};

const renderDetails = (row: MyPropertyRow, onOpenDetail?: () => void) =>
  render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', commuteDataSource: 'mock' }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter>
          <Panel row={row} onOpenDetail={onOpenDetail} />
        </MemoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>,
  );

it('통근 시간이 나온 내 매물은 매물에서 출발하는 동선을 함께 보여 준다', async () => {
  let requested = '';
  server.use(
    http.get('*/api/properties/:propertyId/commute-route', ({ request, params }) => {
      requested = `${String(params.propertyId)}?${new URL(request.url).searchParams.toString()}`;
      return HttpResponse.json({
        code: 'SUCCESS',
        message: '요청에 성공했습니다.',
        data: {
          totalMinutes: 20,
          transferCount: 0,
          legs: [
            {
              type: 'WALK',
              routeName: null,
              minutes: 3,
              waitMinutes: 0,
              points: [
                { stopId: null, name: '출발지', latitude: 37.5, longitude: 127.0 },
                { stopId: 'S1', name: '역삼역 정류장', latitude: 37.501, longitude: 127.0 },
              ],
            },
            {
              type: 'BUS',
              routeName: '146',
              minutes: 17,
              waitMinutes: 2,
              points: [
                { stopId: 'S1', name: '역삼역 정류장', latitude: 37.501, longitude: 127.0 },
                { stopId: null, name: '목적지', latitude: 37.55, longitude: 127.0 },
              ],
            },
          ],
        },
      });
    }),
  );

  renderDetails(property({ propertyId: 7, propertyName: '역삼동 원룸', status: 'REACHABLE', commuteMinutes: 20 }));

  expect(await screen.findByRole('heading', { name: '예상 20분 · 환승 0회' })).toBeInTheDocument();
  expect(screen.getByText(/역삼역 정류장 승차/)).toBeInTheDocument();
  expect(requested).toBe('7?latitude=37.55&longitude=127');
});

it('위치가 없거나 너무 먼 매물은 동선을 부르지 않는다', async () => {
  let calls = 0;
  server.use(
    http.get('*/api/properties/:propertyId/commute-route', () => {
      calls += 1;
      return HttpResponse.json({}, { status: 500 });
    }),
  );

  renderDetails(property({ propertyId: 7, propertyName: '역삼동 원룸', status: 'UNREACHABLE', commuteMinutes: null }));
  renderDetails(property({ propertyId: 7, propertyName: '역삼동 원룸', status: 'NO_LOCATION', commuteMinutes: null }));

  expect(screen.getAllByRole('region', { name: '매물 요약' })).toHaveLength(2);
  expect(screen.queryByRole('heading', { name: /예상 \d+분/ })).not.toBeInTheDocument();
  expect(calls).toBe(0);
});

it.each([
  {
    name: '경로가 없는 응답',
    respond: () =>
      HttpResponse.json(
        { code: 'COMMUTE_ROUTE_NOT_FOUND', message: '경로를 찾을 수 없습니다.', errors: [] },
        { status: 404 },
      ),
  },
  {
    name: '네트워크 오류',
    respond: () => HttpResponse.error(),
  },
  {
    name: '지점이 비어 있는 잘못된 경로 응답',
    respond: () =>
      HttpResponse.json({
        code: 'SUCCESS',
        message: '요청에 성공했습니다.',
        data: {
          totalMinutes: 20,
          transferCount: 0,
          legs: [{ type: 'BUS', routeName: '146', minutes: 20, waitMinutes: 0, points: [] }],
        },
      }),
  },
])('$name이 와도 매물 정보는 유지하고 경로를 다시 불러올 수 있다', async ({ respond }) => {
  const user = userEvent.setup();
  server.use(http.get('*/api/properties/:propertyId/commute-route', () => respond(), { once: true }));

  renderDetails(property({ propertyId: 7, propertyName: '역삼동 원룸', status: 'REACHABLE', commuteMinutes: 20 }));

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '매물 요약' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '경로 다시 불러오기' }));

  expect(await screen.findByRole('heading', { name: '예상 20분 · 환승 0회' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('위는 매물 요약, 아래는 출퇴근 장소와 노선이고, 요약을 누르면 상세 열기를 부른다', async () => {
  const user = userEvent.setup();
  const onOpenDetail = vi.fn();

  renderDetails(
    property({ propertyId: 7, propertyName: '역삼동 원룸', status: 'UNREACHABLE', commuteMinutes: null }),
    onOpenDetail,
  );

  expect(within(screen.getByRole('region', { name: '매물 요약' })).getByText('역삼동 원룸')).toBeInTheDocument();
  const detail = within(screen.getByRole('region', { name: '동네 찾기 상세' }));
  expect(detail.getByText('회사')).toBeInTheDocument();
  expect(detail.getByText('서울 중구')).toBeInTheDocument();
  expect(detail.getByRole('group', { name: '출퇴근 장소' })).toBeInTheDocument();
  expect(detail.queryByRole('heading', { name: '출퇴근 장소' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: '역삼동 원룸' }));
  expect(onOpenDetail).toHaveBeenCalledTimes(1);
});

it('예시 매물은 요약만 보이고 노선을 부르지 않으며 안내를 띄운다', () => {
  let calls = 0;
  server.use(
    http.get('*/api/properties/:propertyId/commute-route', () => {
      calls += 1;
      return HttpResponse.json({}, { status: 500 });
    }),
  );

  renderDetails({
    ...property({ propertyId: 7, propertyName: '역삼동 원룸', status: 'REACHABLE', commuteMinutes: 20 }),
    isPreview: true,
  });

  expect(screen.getByText('예시 매물이라 통근 시간을 계산하지 않아요')).toBeInTheDocument();
  expect(calls).toBe(0);
});
