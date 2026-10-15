// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  formatManwon,
  formatRentSummary,
  formatWon,
  getSafeHttpUrl,
  parsePositiveId,
} from '@/features/property/lib/propertyFormat';

describe('매물 표시 형식과 경로 입력', () => {
  it('원화와 만원 단위 금액을 한국어 형식으로 표시한다', () => {
    expect(formatWon(1_234_000)).toBe('1,234,000원');
    expect(formatManwon(1_234_000)).toBe('123.4만원');
  });

  it('월세가 없으면 전세 형식으로, 있으면 보증금과 월세를 함께 표시한다', () => {
    expect(formatRentSummary(100_000_000, 0)).toBe('전세 10,000');
    expect(formatRentSummary(10_000_000, 550_000)).toBe('1,000/55');
  });

  it('http와 https만 외부 링크로 허용하고 나머지는 거부한다', () => {
    expect(getSafeHttpUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(getSafeHttpUrl('http://example.com')).toBe('http://example.com/');
    expect(getSafeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(getSafeHttpUrl('not a url')).toBeNull();
  });

  it('양의 안전 정수 ID만 경로 파라미터로 변환한다', () => {
    expect(parsePositiveId('10')).toBe(10);
    expect(parsePositiveId('0')).toBeNull();
    expect(parsePositiveId('1.5')).toBeNull();
    expect(parsePositiveId(undefined)).toBeNull();
  });
});
