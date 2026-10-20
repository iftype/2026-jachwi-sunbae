// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  formatAmountForInput,
  formatMoneyInput,
  MAX_PROPERTY_AMOUNT,
  parseMoneyInput,
  propertyFieldErrorMessage,
  toPropertyInputDto,
  validatePropertyForm,
} from '@/features/property/lib/propertyForm';

const validValues = {
  name: '매물',
  depositAmount: '1,000',
  monthlyRentAmount: '55',
  discoverySource: '',
};

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
    expect(parseMoneyInput(`${MAX_PROPERTY_AMOUNT + 1}`)).toBeNull();
  });

  it('Number가 숫자로 읽는 지수·16진수 표기도 숫자만 허용하는 규칙으로 거부한다', () => {
    expect(parseMoneyInput('1e3')).toBeNull();
    expect(parseMoneyInput('0x10')).toBeNull();
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput(' 100')).toBeNull();
  });

  it('만원을 원화로 변환할 때 안전한 최대 입력값까지만 허용한다', () => {
    expect(parseMoneyInput(MAX_PROPERTY_AMOUNT.toLocaleString('ko-KR'))).toBe(MAX_PROPERTY_AMOUNT);
    expect(
      validatePropertyForm({
        name: '매물',
        depositAmount: `${MAX_PROPERTY_AMOUNT + 1}`,
        monthlyRentAmount: `${MAX_PROPERTY_AMOUNT + 1}`,
        discoverySource: '',
      }),
    ).toEqual({
      depositAmount: '보증금이 입력 가능한 최대 금액을 초과했어요.',
      monthlyRentAmount: '월세가 입력 가능한 최대 금액을 초과했어요.',
    });
  });

  it('편집 중 숫자와 콤마만 받아 안정적으로 다시 포맷한다', () => {
    expect(formatMoneyInput('1000000')).toBe('1,000,000');
    expect(formatMoneyInput('1,000,000')).toBe('1,000,000');
    expect(formatMoneyInput('1,0,00')).toBe('1,000');
    expect(formatMoneyInput('1.5')).toBeNull();
    expect(formatMoneyInput('')).toBe('');
    expect(formatMoneyInput(',')).toBeNull();
  });

  it('앞에 붙은 0은 지우되 0 하나는 남긴다', () => {
    expect(formatMoneyInput('007')).toBe('7');
    expect(formatMoneyInput('0')).toBe('0');
    expect(formatMoneyInput('000')).toBe('0');
    expect(formatMoneyInput('0,100')).toBe('100');
  });

  it('원화 금액을 만원 단위 입력값으로 되돌린다', () => {
    expect(formatAmountForInput(5_500_000)).toBe('550');
    expect(formatAmountForInput(10_000_000)).toBe('1,000');
    expect(formatAmountForInput(12_345)).toBe('1.23');
    expect(formatAmountForInput(0)).toBe('0');
  });

  it('모든 값이 유효하면 오류가 없다', () => {
    expect(validatePropertyForm(validValues)).toEqual({});
    expect(
      validatePropertyForm({
        ...validValues,
        depositAmount: '0',
        monthlyRentAmount: '0',
        address: '서울 중구 세종대로',
        discoverySource: '동네 중개사',
      }),
    ).toEqual({});
  });

  it('비어 있는 필수 입력은 필드별 안내 문구를 돌려준다', () => {
    expect(
      validatePropertyForm({
        name: ' ',
        depositAmount: '',
        monthlyRentAmount: '',
        discoverySource: ' ',
      }),
    ).toEqual({
      name: '매물을 구분할 이름을 입력해 주세요.',
      depositAmount: '보증금을 입력해 주세요.',
      monthlyRentAmount: '월세를 입력해 주세요.',
    });
  });

  it('숫자가 아닌 금액은 최대 금액 초과 안내로 거부한다', () => {
    expect(validatePropertyForm({ ...validValues, depositAmount: '천만원', monthlyRentAmount: '1.5' })).toEqual({
      depositAmount: '보증금이 입력 가능한 최대 금액을 초과했어요.',
      monthlyRentAmount: '월세가 입력 가능한 최대 금액을 초과했어요.',
    });
  });

  it('길이 경계는 공백을 제외하고 최대 길이까지 허용한다', () => {
    expect(
      validatePropertyForm({
        name: ` ${'가'.repeat(30)} `,
        depositAmount: '0',
        monthlyRentAmount: '0',
        discoverySource: ` ${'나'.repeat(500)} `,
        address: ` ${'다'.repeat(255)} `,
      }),
    ).toEqual({});
    expect(
      validatePropertyForm({
        name: '가'.repeat(31),
        depositAmount: '0',
        monthlyRentAmount: '0',
        discoverySource: '나'.repeat(501),
        address: '다'.repeat(256),
      }),
    ).toEqual({
      name: '이름은 30자 이하로 입력해 주세요.',
      discoverySource: '확인한 곳은 500자 이하로 입력해 주세요.',
      address: '주소는 255자 이하로 입력해 주세요.',
    });
    expect(validatePropertyForm({ ...validValues, name: '😀'.repeat(16) })).toEqual({
      name: '이름은 30자 이하로 입력해 주세요.',
    });
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

  it('이름과 주소는 공백을 지우고 금액은 만원 단위를 원화로 바꿔 보낸다', () => {
    expect(
      toPropertyInputDto({
        name: ' 매물 ',
        depositAmount: '1,000',
        monthlyRentAmount: '55',
        discoverySource: '',
        address: ' 서울 중구 세종대로 ',
        latitude: 37.5665,
        longitude: 126.978,
      }),
    ).toMatchObject({
      name: '매물',
      depositAmount: 10_000_000,
      monthlyRentAmount: 550_000,
      address: '서울 중구 세종대로',
      latitude: 37.5665,
      longitude: 126.978,
    });
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

  it('서버 필드 오류는 필드별 안내 문구로 바꾼다', () => {
    expect(propertyFieldErrorMessage('name')).toBe('서버에서 매물 이름을 확인하지 못했습니다.');
    expect(propertyFieldErrorMessage('address')).toBe('주소를 확인해 주세요.');
    expect(propertyFieldErrorMessage('latitude')).toBe('선택한 위치의 위도를 확인해 주세요.');
  });
});
