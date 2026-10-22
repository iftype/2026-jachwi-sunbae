// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  formatDateTime,
  formatManwon,
  formatRentSummary,
  formatWon,
  getChecklistStageLabel,
  getSafeHttpUrl,
  parsePositiveId,
} from '@/features/property/lib/propertyFormat';

describe('매물 표시 형식과 경로 입력', () => {
  it('원화와 만원 단위 금액을 한국어 형식으로 표시한다', () => {
    expect(formatWon(1_234_000)).toBe('1,234,000원');
    expect(formatManwon(1_234_000)).toBe('123.4만원');
    // 만원 단위는 소수 둘째 자리까지만 보여 준다.
    expect(formatManwon(12_345)).toBe('1.23만원');
  });

  it('월세가 없으면 전세 형식으로, 있으면 보증금과 월세를 함께 표시한다', () => {
    expect(formatRentSummary(100_000_000, 0)).toBe('전세 10,000');
    expect(formatRentSummary(10_000_000, 550_000)).toBe('1,000/55');
    // 좁은 자리라 소수 첫째 자리까지만 보여 준다.
    expect(formatRentSummary(1_234_500, 0)).toBe('전세 123.5');
    expect(formatRentSummary(1_234_500, 335_000)).toBe('123.5/33.5');
  });

  it('일시는 한국어 연월일과 두 자리 시각으로 표시한다', () => {
    expect(formatDateTime('2026-10-02T09:05:00')).toMatch(/^2026년 10월 2일 (오전 |AM )?09:05$/);
  });

  it('체크리스트 단계 이름을 돌려준다', () => {
    expect(getChecklistStageLabel('ON_SITE')).toBe('집에서 확인');
    expect(getChecklistStageLabel('PRE_CONTRACT')).toBe('계약 전');
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
    // Number()가 숫자로 읽는 지수 표기와 앞 공백도 경로 ID로는 거부한다.
    expect(parsePositiveId('1e3')).toBeNull();
    expect(parsePositiveId(' 1')).toBeNull();
    expect(parsePositiveId('1')).toBe(1);
  });
});
