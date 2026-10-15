// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { selectSingleCategory } from '@/features/map/lib/mapPresentation';

describe('지도 시설 카테고리 선택', () => {
  it('한 번에 한 카테고리만 켠다', () => {
    expect(selectSingleCategory([], 'CONVENIENCE')).toEqual(['CONVENIENCE']);
    expect(selectSingleCategory(['CONVENIENCE'], 'AGENCY')).toEqual(['AGENCY']);
  });

  it('켜져 있는 카테고리를 다시 누르면 끈다', () => {
    expect(selectSingleCategory(['AGENCY'], 'AGENCY')).toEqual([]);
  });
});
