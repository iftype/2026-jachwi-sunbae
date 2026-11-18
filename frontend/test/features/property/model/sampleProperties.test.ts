import { describe, expect, it } from 'vitest';

import type { PropertySummary } from '@/features/property/model/Property';
import {
  isPreviewProperty,
  parsePropertyRouteId,
  SAMPLE_PROPERTIES,
  withPreviewProperties,
} from '@/features/property/model/sampleProperties';

const registered = { ...SAMPLE_PROPERTIES[0], propertyId: 10, name: '신림역 원룸' } satisfies PropertySummary;

describe('withPreviewProperties', () => {
  it('목록을 다 받았는데 등록한 방이 없으면 미리보기 매물을 대신 돌려준다', () => {
    expect(withPreviewProperties([], true)).toEqual({ properties: SAMPLE_PROPERTIES, isPreview: true });
  });

  it('아직 불러오는 중이면 미리보기 매물을 섞지 않는다', () => {
    expect(withPreviewProperties([], false)).toEqual({ properties: [], isPreview: false });
  });

  it('방을 하나라도 등록하면 미리보기 매물은 사라진다', () => {
    expect(withPreviewProperties([registered], true)).toEqual({ properties: [registered], isPreview: false });
  });
});

describe('미리보기 매물 id', () => {
  it('미리보기 매물은 음수 id라 실제 매물과 겹치지 않는다', () => {
    expect(SAMPLE_PROPERTIES.length).toBeGreaterThan(0);
    expect(SAMPLE_PROPERTIES.every((property) => isPreviewProperty(property.propertyId))).toBe(true);
    expect(isPreviewProperty(10)).toBe(false);
    expect(isPreviewProperty('10')).toBe(false);
  });

  it('매물 주소는 양수 id와 미리보기 매물 id만 받는다', () => {
    const previewId = SAMPLE_PROPERTIES[0].propertyId;
    expect(parsePropertyRouteId('10')).toBe(10);
    expect(parsePropertyRouteId(String(previewId))).toBe(previewId);
    expect(parsePropertyRouteId('-999')).toBeNull();
    expect(parsePropertyRouteId('0')).toBeNull();
    expect(parsePropertyRouteId('abc')).toBeNull();
    expect(parsePropertyRouteId(undefined)).toBeNull();
  });
});
