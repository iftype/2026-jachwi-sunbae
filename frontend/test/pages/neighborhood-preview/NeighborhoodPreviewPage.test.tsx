import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

import { commuteBoundaryFixtures } from '@/app/mocks/fixtures/commuteBoundaryFixtures';
import { createCommuteAreaHandlers } from '@/app/mocks/handlers/commuteAreaHandlers';
import NeighborhoodEntryPage from '@/pages/neighborhood-entry/NeighborhoodEntryPage';
import NeighborhoodPreviewPage from '@/pages/neighborhood-preview/NeighborhoodPreviewPage';
import NeighborhoodRoutePage from '@/pages/neighborhood-preview/NeighborhoodRoutePage';
import { MapLocationError, readGeolocationPermission, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

vi.mock('@/features/map/lib/mapLocation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/map/lib/mapLocation')>()),
  readGeolocationPermission: vi.fn(),
  requestCurrentMapLocation: vi.fn(),
}));
vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: (props: MapCanvasProps) => (
    <div>
      <button onClick={() => props.onSelectLocation?.(37.4, 127.12)}>지도에서 위치 찍기</button>
      {props.onSelectLocation && (
        <button onClick={() => props.onSelectLocation?.(37.45, 127.15)}>다른 위치 찍기</button>
      )}
      <output aria-label="지도 시점">{JSON.stringify({ center: props.center, level: props.level })}</output>
      <output aria-label="목적지 좌표">{JSON.stringify(props.markers)}</output>
      {props.regions?.map((region) => (
        <button key={region.id} onClick={() => props.onSelectRegion?.(region.id)}>
          {region.name}
        </button>
      ))}
    </div>
  ),
}));
beforeEach(() => {
  vi.mocked(readGeolocationPermission).mockResolvedValue('prompt');
  vi.mocked(requestCurrentMapLocation).mockReset();
  server.use(...createCommuteAreaHandlers({ delayMs: 0 }));
  server.use(
    http.get('*/api/maps/reverse-geocode', () =>
      HttpResponse.json({
        code: 'SUCCESS',
        message: '성공',
        data: { roadAddress: '경기 성남시 분당구 판교역로', jibunAddress: null, latitude: 37.4, longitude: 127.12 },
      }),
    ),
  );
  server.use(
    http.get('*/boundaries/manifest.json', () =>
      HttpResponse.json({ version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' }),
    ),
    http.get('*/boundaries/:filename', () =>
      HttpResponse.json({
        type: 'FeatureCollection',
        features: commuteBoundaryFixtures.map((fixture) => ({
          type: 'Feature',
          properties: {
            code: fixture.sourceCode,
            name: fixture.fullName.split(' ').at(-1),
            fullName: fixture.fullName,
            baseDate: '20250630',
          },
          geometry: fixture.boundary,
        })),
      }),
    ),
  );
});
const show = (mode = 'commute') => {
  const result = render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', commuteDataSource: 'mock' }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={[`/neighborhoods/map?mode=${mode}`]}>
          <Routes>
            <Route path="/neighborhoods/map" element={<NeighborhoodPreviewPage />}>
              <Route path="areas/:adminDongCode" element={<NeighborhoodRoutePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>,
  );
  return result;
};
const choosePoint = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  return user;
};
it('첫 진입은 지도이며 위치 미허용 시 권한 요청·직접 선택 입구·하단 확인 화면이 없다', async () => {
  show();
  await waitFor(() => expect(readGeolocationPermission).toHaveBeenCalled());
  expect(requestCurrentMapLocation).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: '지도에서 목적지 선택' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '지도에서 직접 선택' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '이 위치로 선택' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '출퇴근 장소' })).not.toHaveFocus();
  expect(screen.getByRole('spinbutton', { name: '최대 통근 시간' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '최대 환승 횟수' })).toBeInTheDocument();
  expect(screen.getByRole('complementary', { name: '동네 찾기 시작 안내' })).toHaveTextContent('학교·회사');
});
it('위치 권한이 이미 허용된 경우 현재 위치로 시작한다', async () => {
  vi.mocked(readGeolocationPermission).mockResolvedValue('granted');
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show();
  expect(await screen.findByRole('spinbutton', { name: '최대 통근 시간' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55');
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('현재 위치');
});
it('현재 위치 조회 실패 시 지도에서 직접 찍을 수 있다', async () => {
  vi.mocked(readGeolocationPermission).mockResolvedValue('granted');
  vi.mocked(requestCurrentMapLocation).mockRejectedValue(new Error('timeout'));
  show();
  await waitFor(() => expect(requestCurrentMapLocation).toHaveBeenCalled());
  await choosePoint();
  expect(screen.getByRole('spinbutton', { name: '최대 통근 시간' })).toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: '동네 찾기 시작 안내' })).not.toBeInTheDocument();
});
it('현재 위치 버튼 실패를 안내하고 재시도하면 목적지로 선택한다', async () => {
  vi.mocked(requestCurrentMapLocation)
    .mockRejectedValueOnce(new MapLocationError('denied', 'denied'))
    .mockResolvedValueOnce({ latitude: 37.55, longitude: 127.05 });
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('위치 권한을 허용');
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55'));
  expect(screen.getByRole('button', { name: '선택한 조건으로 찾기' })).toBeInTheDocument();
});
it('검색 결과의 현재 위치 버튼은 목적지와 결과를 유지하고 지도만 이동한다', async () => {
  vi.mocked(requestCurrentMapLocation).mockResolvedValue({ latitude: 37.55, longitude: 127.05 });
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  await user.click(screen.getByRole('button', { name: '내 현재 위치로 이동' }));
  await waitFor(() => expect(screen.getByLabelText('지도 시점')).toHaveTextContent('37.55'));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('current-location');
});
it('지도에서 찍으면 바로 조건을 선택하고 지도 시점은 유지한다', async () => {
  show();
  const view = screen.getByLabelText('지도 시점').textContent;
  await choosePoint();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: '최대 통근 시간' })).toBeInTheDocument();
  expect(screen.getByLabelText('지도 시점').textContent).toBe(view);
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
});
it('검색으로도 위치를 선택할 수 있다', async () => {
  show();
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '출퇴근 장소' }), '판교');
  await user.keyboard('{Enter}');
  expect(screen.getByRole('spinbutton', { name: '최대 통근 시간' })).toBeInTheDocument();
});
it('통근 필터·조회·동네 선택 및 닫기에도 결과와 시점을 유지한다', async () => {
  show();
  const user = await choosePoint();
  await user.selectOptions(screen.getByRole('combobox', { name: '최대 환승 횟수' }), '0');
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  const view = screen.getByLabelText('지도 시점').textContent;
  expect(screen.queryByRole('button', { name: '정자동' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '역삼1동' }));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  const handle = screen.getByRole('button', { name: '상세 패널 높이 조절' });
  await user.click(handle);
  expect(handle).toHaveAttribute('aria-expanded', 'true');
  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('지도 시점').textContent).toBe(view);
  expect(screen.getByRole('button', { name: '역삼1동' })).toBeInTheDocument();
});
it('상위 동네 카드를 선택하면 첫 정류장의 상세 경로를 받고 다른 정류장도 선택할 수 있다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.getByLabelText('통근 시간 상위 동네').querySelectorAll('button')).toHaveLength(3);
  const view = screen.getByLabelText('지도 시점').textContent;
  await user.click(screen.getByRole('button', { name: /1위 역삼1동/ }));
  expect(await screen.findByLabelText('대중교통 경로')).toHaveTextContent('예상 3분');
  expect(screen.getByLabelText('대중교통 경로')).toHaveTextContent('도보');
  await user.click(screen.getByRole('button', { name: /역삼역.포스코센터/ }));
  await waitFor(() => expect(screen.getByLabelText('대중교통 경로')).toHaveTextContent('예상 5분'));
  await user.click(screen.getByRole('button', { name: '상세 패널 높이 조절' }));
  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('지도 시점').textContent).toBe(view);
});
it('가격 기준에서는 통근 필터를 숨긴다', async () => {
  show('price');
  await choosePoint();
  expect(screen.queryByRole('spinbutton', { name: '최대 통근 시간' })).not.toBeInTheDocument();
});
it('지도 첫 진입에는 탐색 기준을 선택하고 상단 탭은 표시하지 않는다', async () => {
  render(
    <MemoryRouter>
      <NeighborhoodEntryPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: '자취할 동네를 찾아보세요' })).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /월세 평균가 보기/ })).toHaveAttribute(
    'href',
    '/neighborhoods/map?mode=price',
  );
});
it('통근 서버 오류는 가짜 결과로 대체하지 않는다', async () => {
  server.use(...createCommuteAreaHandlers({ scenario: 'network-unavailable', delayMs: 0 }));
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('대중교통 정보를 준비하고 있습니다.');
  expect(screen.queryByRole('region', { name: '행정동 프리셋 지도' })).not.toBeInTheDocument();
});
it('환승은 두 회까지, 통근은 5분 단위로만 조회한다', async () => {
  show();
  const user = await choosePoint();
  expect(screen.getAllByRole('option')).toHaveLength(3);
  const minutes = screen.getByRole('spinbutton', { name: '최대 통근 시간' });
  expect(minutes).toHaveAttribute('step', '5');
  await user.clear(minutes);
  expect(screen.getByRole('button', { name: '선택한 조건으로 찾기' })).toBeDisabled();
  await user.type(minutes, '7');
  expect(screen.getByRole('button', { name: '선택한 조건으로 찾기' })).toBeDisabled();
  await user.clear(minutes);
  await user.type(minutes, '25');
  expect(screen.getByRole('button', { name: '선택한 조건으로 찾기' })).toBeEnabled();
});
it('경계는 조회 버튼 이후에만 원본을 받고 다시 조회하면 캐시를 재사용한다', async () => {
  const paths: string[] = [];
  const track = ({ request }: { request: Request }) => paths.push(new URL(request.url).pathname);
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    expect(paths.filter((path) => path.includes('/boundaries/'))).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(paths.filter((path) => path.endsWith('.geojson'))).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(paths.filter((path) => path.endsWith('.geojson'))).toHaveLength(1);
    expect(paths.filter((path) => path.endsWith('/manifest.json'))).toHaveLength(2);
  } finally {
    server.events.removeListener('request:start', track);
  }
});
it('manifest의 해시가 바뀌면 이전 경계 캐시 대신 새 파일을 받는다', async () => {
  let file = 'admin-dongs.20250630.123456abcdef.geojson';
  server.use(http.get('*/boundaries/manifest.json', () => HttpResponse.json({ version: '20250630', file })));
  const files: string[] = [];
  const track = ({ request }: { request: Request }) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith('.geojson')) files.push(path);
  };
  server.events.on('request:start', track);
  try {
    show();
    const user = await choosePoint();
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    file = 'admin-dongs.20250630.abcdef123456.geojson';
    await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
    await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
    await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
    await screen.findByRole('region', { name: '행정동 프리셋 지도' });
    expect(files).toEqual([
      '/boundaries/admin-dongs.20250630.123456abcdef.geojson',
      '/boundaries/admin-dongs.20250630.abcdef123456.geojson',
    ]);
  } finally {
    server.events.removeListener('request:start', track);
  }
});
it('결과 지도 클릭은 목적지·결과를 유지하고 다시 선택하기를 눌러야 새 위치를 고른다', async () => {
  show();
  const user = await choosePoint();
  await user.click(screen.getByRole('button', { name: '다른 위치 찍기' }));
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.45');
  await user.click(screen.getByRole('button', { name: '선택한 조건으로 찾기' }));
  await screen.findByRole('region', { name: '행정동 프리셋 지도' });
  expect(screen.queryByText('거래 평균가')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '역삼1동' }));
  await user.keyboard('{Escape}');
  const markers = screen.getByLabelText('목적지 좌표').textContent;
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.getByRole('region', { name: '행정동 프리셋 지도' })).toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표').textContent).toBe(markers);
  await user.click(screen.getByRole('button', { name: '다시 선택하기' }));
  await user.click(screen.getByRole('button', { name: '지도에서 위치 찍기' }));
  expect(screen.queryByRole('region', { name: '행정동 프리셋 지도' })).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: '선택한 동네 정보' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('목적지 좌표')).toHaveTextContent('37.4');
  expect(screen.getByRole('button', { name: '선택한 조건으로 찾기' })).toBeEnabled();
});
