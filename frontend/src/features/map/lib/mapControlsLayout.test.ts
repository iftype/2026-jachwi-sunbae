import { describe, expect, it } from 'vitest';

import { MOBILE_MAP_CONTROLS_TOP, MOBILE_MAP_RAIL_TOP } from './mapControlsLayout';

describe('휴대폰 지도 오른쪽 컨트롤 열 위치', () => {
  it('확대 축소 버튼이 있던 높이만큼 올라와 머리 줄 아래에서 시작한다', () => {
    expect(MOBILE_MAP_CONTROLS_TOP).toBe('calc(max(0.85rem, env(safe-area-inset-top)) + 8rem)');
  });

  it('분류 카드는 찜 토글 바로 아래에서 같은 기준값을 따라간다', () => {
    expect(MOBILE_MAP_RAIL_TOP).toContain(MOBILE_MAP_CONTROLS_TOP);
    expect(MOBILE_MAP_RAIL_TOP).toContain('2.65rem');
  });
});
