import { describe, expect, it } from 'vitest';

import {
  formatMoneyInput,
  MAX_PROPERTY_AMOUNT,
  parseMoneyInput,
  toPropertyInputDto,
  validatePropertyForm,
} from '@/features/property/lib/propertyForm';

describe('매물 입력 검증', () => {
  it('금액 0과 최대 안전 정수를 허용한다', () => {
    expect(parseMoneyInput('0')).toBe(0);
    expect(parseMoneyInput(MAX_PROPERTY_AMOUNT.toLocaleString('ko-KR'))).toBe(MAX_PROPERTY_AMOUNT);
  });

  it('음수·소수·NaN·최대 안전 정수 초과를 거부한다', () => {
    expect(parseMoneyInput('-1')).toBeNull();
    expect(parseMoneyInput('1.5')).toBeNull();
    expect(parseMoneyInput('NaN')).toBeNull();
    expect(parseMoneyInput('9,007,199,254,740,992')).toBeNull();
  });

  it('만원을 원화로 변환할 때 안전한 최대 입력값까지만 허용한다', () => {
    expect(parseMoneyInput(MAX_PROPERTY_AMOUNT.toLocaleString('ko-KR'))).toBe(MAX_PROPERTY_AMOUNT);
    expect(
      validatePropertyForm({
        name: '매물',
        depositAmount: `${MAX_PROPERTY_AMOUNT + 1}`,
        monthlyRentAmount: '0',
        discoverySource: '',
      }),
    ).toMatchObject({ depositAmount: expect.any(String) });
  });

  it('편집 중 숫자와 콤마만 받아 안정적으로 다시 포맷한다', () => {
    expect(formatMoneyInput('1000000')).toBe('1,000,000');
    expect(formatMoneyInput('1,000,000')).toBe('1,000,000');
    expect(formatMoneyInput('1.5')).toBeNull();
    expect(formatMoneyInput('')).toBe('');
  });

  it('모든 필수 입력과 길이 경계를 검증한다', () => {
    expect(
      validatePropertyForm({
        name: ' ',
        depositAmount: '',
        monthlyRentAmount: '',
        discoverySource: ' ',
      }),
    ).toEqual({
      name: expect.any(String),
      depositAmount: expect.any(String),
      monthlyRentAmount: expect.any(String),
    });
    expect(
      validatePropertyForm({
        name: '가'.repeat(31),
        depositAmount: '0',
        monthlyRentAmount: '0',
        discoverySource: '나'.repeat(501),
        address: '다'.repeat(256),
      }),
    ).toMatchObject({
      name: expect.any(String),
      discoverySource: expect.any(String),
      address: expect.any(String),
    });

    expect(
      validatePropertyForm({
        name: '😀'.repeat(16),
        depositAmount: '0',
        monthlyRentAmount: '0',
        discoverySource: '',
      }),
    ).toMatchObject({ name: expect.any(String) });
  });

  it('URL과 일반 텍스트 발견 경로를 같은 요청 문자열로 보존한다', () => {
    const base = { name: ' 매물 ', depositAmount: '0', monthlyRentAmount: '55' };
    expect(toPropertyInputDto({ ...base, discoverySource: ' https://example.com/home ' })?.discoverySource).toBe(
      'https://example.com/home',
    );
    expect(toPropertyInputDto({ ...base, discoverySource: ' 동네 중개사 추천 ' })?.discoverySource).toBe(
      '동네 중개사 추천',
    );
    expect(toPropertyInputDto({ ...base, discoverySource: '' })?.monthlyRentAmount).toBe(550_000);
  });

  it('비어 있는 금액은 저장 전 검증하고 DTO 기본값은 새 API 필드를 모두 포함한다', () => {
    expect(
      toPropertyInputDto({
        name: '매물',
        depositAmount: '',
        monthlyRentAmount: '',
        discoverySource: '',
      }),
    ).toEqual({
      name: '매물',
      depositAmount: 0,
      monthlyRentAmount: 0,
      discoverySource: null,
      address: null,
      latitude: null,
      longitude: null,
      availableMoveInDate: null,
      maintenanceFeeAmount: null,
      visitScheduledAt: null,
      roomOptions: [],
      utilityOptions: [],
    });
  });
});
