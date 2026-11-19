import { describe, expect, it } from 'vitest';

import {
  DESKTOP_MAP_CONTROLS_TOP,
  DESKTOP_MAP_LOCATE_BOTTOM,
  DESKTOP_MAP_RAIL_TOP,
  MOBILE_MAP_CONTROLS_TOP,
  MOBILE_MAP_RAIL_TOP,
} from './mapControlsLayout';

describe('휴대폰 지도 오른쪽 컨트롤 열 위치', () => {
  it('확대 축소 버튼이 있던 높이만큼 올라와 머리 줄 아래에서 시작한다', () => {
    expect(MOBILE_MAP_CONTROLS_TOP).toBe('calc(max(0.85rem, env(safe-area-inset-top)) + 8rem)');
  });

  it('분류 카드는 찜 토글 바로 아래에서 같은 기준값을 따라간다', () => {
    expect(MOBILE_MAP_RAIL_TOP).toContain(MOBILE_MAP_CONTROLS_TOP);
    expect(MOBILE_MAP_RAIL_TOP).toContain('2.65rem');
  });
});

describe('데스크탑 지도 오른쪽 컨트롤 열 위치', () => {
  it('찜 토글은 확대 축소 버튼(4.75rem에서 약 5.3rem) 바로 아래에서 시작한다', () => {
    expect(DESKTOP_MAP_CONTROLS_TOP).toBe('10.55rem');
  });

  it('분류 카드는 찜 토글 바로 아래에서 같은 기준값을 따라간다', () => {
    expect(DESKTOP_MAP_RAIL_TOP).toContain(DESKTOP_MAP_CONTROLS_TOP);
    expect(DESKTOP_MAP_RAIL_TOP).toContain('2.65rem');
  });

  it('현재 위치 버튼은 열에서 떼어 지도 아래 가장자리 위에 둔다', () => {
    expect(DESKTOP_MAP_LOCATE_BOTTOM).toBe('1.25rem');
  });
});
