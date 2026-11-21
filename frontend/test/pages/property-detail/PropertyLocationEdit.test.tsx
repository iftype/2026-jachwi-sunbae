import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { propertyChecklistHandlers } from '@/app/mocks/handlers/propertyChecklistHandlers';
import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import { failure, getMockProperties, resetMockStore, setMockProperties } from '@/app/mocks/mockStore';
import PropertyDetailPage from '@/pages/property-detail/PropertyDetailPage';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';
import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import { resetMovedPropertyForTests, takeMovedProperty } from '@/features/property/model/movedProperty';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

const MOVED = { latitude: 37.5662, longitude: 126.9785 };
const tap = vi.hoisted(() => ({ to: { latitude: 37.5662, longitude: 126.9785 } }));

// 상세 안 주변 지도. 위치를 고르는 동안에만 지도를 누를 수 있다.
vi.mock('@/features/map/ui/map-canvas/MapCanvas', () => ({
  default: ({ onSelectLocation }: MapCanvasProps) => (
    <button
      type="button"
      disabled={onSelectLocation === undefined}
      onClick={() => onSelectLocation?.(tap.to.latitude, tap.to.longitude)}
    >
      지도 누르기
    </button>
  ),
}));

beforeEach(() => {
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(...propertyHandlers, ...propertyChecklistHandlers, ...mapHandlers);
});
afterEach(() => {
  resetAuthenticationForTests();
  resetMovedPropertyForTests();
  resetMockStore();
  queryClient.clear();
  sessionStorage.clear();
  tap.to = MOVED;
});

/** 좌표가 없는 매물이 넘어오는 위치 선택 화면. 받은 state만 보인다. */
const LocationSelectStub = () => <output aria-label="위치 선택 화면">{JSON.stringify(useLocation().state)}</output>;

const renderDetail = () => {
  const router = createMemoryRouter(
    [
      { path: '/properties/:propertyId', element: <PropertyDetailPage /> },
      { path: '/map/select-location', element: <LocationSelectStub /> },
    ],
    {
      initialEntries: [{ pathname: '/properties/10', search: '?tab=details', state: { returnTo: '/properties' } }],
    },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <RouterProvider router={router} />
      </PublicConfigProvider>
    </QueryClientProvider>,
  );
};

const captureUpdates = () => {
  const bodies: Record<string, unknown>[] = [];
  const track = ({ request }: { request: Request }) => {
    if (request.method === 'PUT' && /\/api\/properties\/\d+$/.test(new URL(request.url).pathname))
      void request
        .clone()
        .json()
        .then((body: Record<string, unknown>) => bodies.push(body));
  };
  server.events.on('request:start', track);
  return { bodies, stop: () => server.events.removeListener('request:start', track) };
};

const openLocationEditor = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^주소 .*수정$/ }));
  await user.click(screen.getByRole('button', { name: '지도에서 고르기' }));
  await screen.findByText('지도를 눌러 새 위치를 고르세요.');
  return user;
};

it('좌표가 있는 매물은 상세 안 주변 지도를 눌러 고른 자리의 주소와 좌표로 저장하고, 옮긴 매물을 기억한다', async () => {
  renderDetail();
  const user = await openLocationEditor();
  const updates = captureUpdates();
  try {
    await user.click(screen.getByRole('button', { name: '지도 누르기' }));
    expect(await screen.findByText('MSW 테스트 위치 (37.56620, 126.97850)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '이 위치로 변경' }));

    await waitFor(() => expect(updates.bodies).toHaveLength(1));
    expect(updates.bodies[0]).toEqual(
      expect.objectContaining({ ...MOVED, address: 'MSW 테스트 위치 (37.56620, 126.97850)' }),
    );
    // 저장하면 고르기를 끝내고 안내를 닫는다.
    await waitFor(() => expect(screen.queryByRole('button', { name: '이 위치로 변경' })).not.toBeInTheDocument());
    // 본 방 기록 지도가 새 자리로 가도록 옮긴 매물을 기억한다.
    expect(takeMovedProperty(() => MOVED)).toEqual(expect.objectContaining({ propertyId: 10, ...MOVED }));
  } finally {
    updates.stop();
  }
});

it('누른 자리의 주소를 찾지 못하면 다른 곳을 누르라고 안내하고 저장하지 않는다', async () => {
  server.use(http.get('*/api/maps/reverse-geocode', () => failure('MAP_ADDRESS_NOT_FOUND', 404)));
  tap.to = { latitude: 34.9, longitude: 125.1 };
  renderDetail();
  const user = await openLocationEditor();
  const updates = captureUpdates();
  try {
    await user.click(screen.getByRole('button', { name: '지도 누르기' }));
    expect(await screen.findByText('이 자리의 주소를 찾지 못했어요. 다른 곳을 눌러 주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '이 위치로 변경' })).not.toBeInTheDocument();

    // 취소하면 고르기를 끝내고 아무것도 저장하지 않는다.
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByText(/이 자리의 주소를 찾지 못했어요/)).not.toBeInTheDocument();
    expect(updates.bodies).toEqual([]);
  } finally {
    updates.stop();
  }
});

it('좌표가 없는 매물은 주소 검색 칸의 지도에서 고르기를 누르면 위치 선택 화면으로 간다', async () => {
  setMockProperties(
    getMockProperties().map((property) =>
      property.id === 10 ? { ...property, latitude: null, longitude: null } : property,
    ),
  );
  renderDetail();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^주소 .*수정$/ }));
  await user.click(screen.getByRole('button', { name: '지도에서 고르기' }));

  const state = await screen.findByLabelText('위치 선택 화면');
  expect(JSON.parse(state.textContent ?? 'null')).toEqual({ returnTo: '/properties/10?tab=details', propertyId: 10 });
  expect(screen.queryByRole('button', { name: '지도 누르기' })).not.toBeInTheDocument();
});

it('주소를 누르면 그 줄에서 검색하고, 고른 결과의 주소와 좌표로 바로 저장한다', async () => {
  renderDetail();
  const user = userEvent.setup();
  const updates = captureUpdates();
  try {
    await user.click(await screen.findByRole('button', { name: /^주소 .*수정$/ }));
    const search = screen.getByRole('textbox', { name: '주소 검색' });
    // 지금 주소를 채워 열어 조금만 고쳐 다시 검색할 수 있다.
    expect(search).toHaveFocus();
    expect(search).not.toHaveValue('');
    await user.clear(search);
    await user.type(search, '서울역{Enter}');
    const results = await screen.findByRole('list', { name: '주소 검색 결과' });
    const [first] = within(results).getAllByRole('button');
    if (first === undefined) throw new Error('검색 결과가 없습니다.');
    await user.click(first);

    await waitFor(() => expect(updates.bodies).toHaveLength(1));
    expect(updates.bodies[0]).toEqual(expect.objectContaining({ latitude: expect.any(Number) }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: '주소 검색' })).not.toBeInTheDocument());
    expect(await screen.findByText('✓ 저장했어요')).toBeInTheDocument();
  } finally {
    updates.stop();
  }
});

it('주소 검색 중 바깥을 누르면 저장하지 않고 닫아 직전 주소를 그대로 보인다', async () => {
  renderDetail();
  const user = userEvent.setup();
  const updates = captureUpdates();
  try {
    const address = await screen.findByRole('button', { name: /^주소 .*수정$/ });
    const before = address.textContent;
    await user.click(address);
    const search = screen.getByRole('textbox', { name: '주소 검색' });
    await user.clear(search);
    await user.type(search, '다른 동네');
    await user.click(screen.getByRole('heading', { level: 1 }));

    expect(screen.queryByRole('textbox', { name: '주소 검색' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^주소 .*수정$/ })).toHaveTextContent(before ?? '');
    expect(updates.bodies).toEqual([]);
  } finally {
    updates.stop();
  }
});

it('주소 검색 중 Esc를 누르면 저장하지 않고 직전 주소로 돌아간다', async () => {
  renderDetail();
  const user = userEvent.setup();
  const address = await screen.findByRole('button', { name: /^주소 .*수정$/ });
  const before = address.textContent;
  await user.click(address);
  await user.type(screen.getByRole('textbox', { name: '주소 검색' }), ' 바꾸는 중');
  await user.keyboard('{Escape}');

  expect(screen.queryByRole('textbox', { name: '주소 검색' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^주소 .*수정$/ })).toHaveTextContent(before ?? '');
});
