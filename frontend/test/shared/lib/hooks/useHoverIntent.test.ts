import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useHoverIntent, { HOVER_HIDE_DELAY_MS, HOVER_SHOW_DELAY_MS } from '@/shared/lib/hooks/useHoverIntent';

describe('useHoverIntent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('올린 뒤 지연이 지나야 뜬다', () => {
    const { result } = renderHook(() => useHoverIntent<string>());
    act(() => result.current.enter('a'));
    expect(result.current.target).toBeNull();
    act(() => void vi.advanceTimersByTime(HOVER_SHOW_DELAY_MS));
    expect(result.current.target).toBe('a');
  });

  it('지연 안에 벗어나면 뜨지 않는다', () => {
    const { result } = renderHook(() => useHoverIntent<string>());
    act(() => result.current.enter('a'));
    act(() => void vi.advanceTimersByTime(HOVER_SHOW_DELAY_MS - 1));
    act(() => result.current.leave());
    act(() => void vi.advanceTimersByTime(HOVER_SHOW_DELAY_MS));
    expect(result.current.target).toBeNull();
  });

  it('벗어나도 유예 안에 다시 올리거나 붙잡으면 닫지 않는다', () => {
    const { result } = renderHook(() => useHoverIntent<string>());
    act(() => result.current.enter('a'));
    act(() => void vi.advanceTimersByTime(HOVER_SHOW_DELAY_MS));
    act(() => result.current.leave());
    act(() => void vi.advanceTimersByTime(HOVER_HIDE_DELAY_MS - 1));
    act(() => result.current.hold());
    act(() => void vi.advanceTimersByTime(HOVER_HIDE_DELAY_MS * 2));
    expect(result.current.target).toBe('a');
    act(() => result.current.leave());
    act(() => void vi.advanceTimersByTime(HOVER_HIDE_DELAY_MS));
    expect(result.current.target).toBeNull();
  });

  it('터치처럼 hover가 없는 기기는 지연 없이 바로 반영한다', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { result } = renderHook(() => useHoverIntent<string>());
    act(() => result.current.enter('a'));
    expect(result.current.target).toBe('a');
  });

  it('언마운트하면 대기 중인 타이머를 지운다', () => {
    const { result, unmount } = renderHook(() => useHoverIntent<string>());
    act(() => result.current.enter('a'));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
