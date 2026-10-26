import { afterEach, describe, expect, it } from 'vitest';

import { MAP_ZOOM_AREA_ATTRIBUTE, preventPageZoom } from '@/shared/lib/page-zoom/preventPageZoom';

const dispatchGesture = (element: Element, type = 'gesturestart'): boolean =>
  element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('preventPageZoom', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    document.body.innerHTML = '';
  });

  it('지도 밖에서 핀치하면 화면 확대를 막는다', () => {
    cleanup = preventPageZoom();
    const button = document.createElement('button');
    document.body.append(button);

    expect(dispatchGesture(button)).toBe(false);
    expect(dispatchGesture(button, 'gesturechange')).toBe(false);
  });

  it('지도 안에서 핀치하면 지도가 처리하도록 그대로 둔다', () => {
    cleanup = preventPageZoom();
    const map = document.createElement('div');
    map.setAttribute(MAP_ZOOM_AREA_ATTRIBUTE, '');
    const tile = document.createElement('div');
    map.append(tile);
    document.body.append(map);

    expect(dispatchGesture(tile)).toBe(true);
  });

  it('해제하면 더 이상 막지 않는다', () => {
    preventPageZoom()();
    const button = document.createElement('button');
    document.body.append(button);

    expect(dispatchGesture(button)).toBe(true);
  });
});
