import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { searchAddress } from '@/features/map/api/mapApi';
import useAddressSearch from '@/features/map/api/useAddressSearch';
import type { MapAddress } from '@/features/map/model/Map';

vi.mock('@/shared/config/PublicConfigContext', () => ({ usePublicConfig: () => ({ apiBaseUrl: '/api' }) }));
vi.mock('@/features/map/api/mapApi', () => ({ searchAddress: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const address: MapAddress = {
  address: '서울',
  roadAddress: '서울',
  jibunAddress: null,
  latitude: 37.5,
  longitude: 127,
};
const deferred = () => {
  let resolve!: (value: MapAddress[]) => void;
  const promise = new Promise<MapAddress[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it('입력만 한 상태와 조회 결과가 없는 상태를 구분한다', async () => {
  vi.mocked(searchAddress).mockResolvedValue([]);
  const { result } = renderHook(() => useAddressSearch());
  act(() => result.current.changeQuery('서울'));
  expect(result.current.status).toBe('idle');
  await act(() => result.current.submit());
  expect(result.current.status).toBe('success');
  expect(result.current.results).toEqual([]);
});

it('먼저 시작한 요청이 늦게 끝나도 최신 검색 결과를 덮지 않는다', async () => {
  const old = deferred();
  vi.mocked(searchAddress).mockReturnValueOnce(old.promise).mockResolvedValueOnce([address]);
  const { result } = renderHook(() => useAddressSearch());
  act(() => result.current.changeQuery('이전 주소'));
  let oldRequest!: Promise<void>;
  act(() => {
    oldRequest = result.current.submit();
  });
  const oldSignal = vi.mocked(searchAddress).mock.calls[0][2];
  act(() => result.current.changeQuery('새 주소'));
  expect(oldSignal?.aborted).toBe(true);
  await act(() => result.current.submit());
  await act(async () => {
    old.resolve([]);
    await oldRequest;
  });
  expect(result.current.results).toEqual([address]);
});

it('검색을 비우거나 화면을 나가면 요청을 취소하고 늦은 응답을 무시한다', async () => {
  const pending = deferred();
  vi.mocked(searchAddress).mockReturnValue(pending.promise);
  const { result, unmount } = renderHook(() => useAddressSearch());
  act(() => result.current.changeQuery('서울'));
  let request!: Promise<void>;
  act(() => {
    request = result.current.submit();
  });
  act(() => result.current.clear());
  await act(async () => {
    pending.resolve([address]);
    await request;
  });
  expect(result.current.status).toBe('idle');
  expect(result.current.results).toEqual([]);
  act(() => result.current.changeQuery('서울'));
  act(() => {
    void result.current.submit();
  });
  const signal = vi.mocked(searchAddress).mock.calls.at(-1)?.[2];
  unmount();
  expect(signal?.aborted).toBe(true);
});
