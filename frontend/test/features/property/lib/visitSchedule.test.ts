// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fromDateTimeLocal, toDateTimeLocal } from '@/features/property/lib/visitSchedule';

describe('방문 일정 형식 변환', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('datetime-local 값을 요일이 포함된 한국어 문구로 변환한다', () => {
    expect(fromDateTimeLocal('2026-10-02T09:05')).toBe('10월 2일 (금) 09:05');
  });

  it('잘못된 datetime-local 값은 빈 문구로 되돌린다', () => {
    expect(fromDateTimeLocal('2026/10/02 09:05')).toBe('');
    expect(toDateTimeLocal('방문 일정 미정')).toBe('');
  });

  it('저장된 방문 일정 문구를 datetime-local 입력값으로 복원한다', () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));

    expect(toDateTimeLocal('10월 2일 (금) 09:05')).toBe('2026-10-02T09:05');
  });

  it('이미 지난 월일은 다음 해 일정으로 해석한다', () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00'));

    expect(toDateTimeLocal('9월 30일 (수) 18:00')).toBe('2027-09-30T18:00');
  });
});

describe('방문 일정 형식 변환 경계', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('월일 사이 공백이 없거나 여러 개여도 같은 일정으로 읽는다', () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));

    expect(toDateTimeLocal('10월2일 09:05')).toBe('2026-10-02T09:05');
    expect(toDateTimeLocal('10월   2일 (금) 9:05')).toBe('2026-10-02T09:05');
  });

  it('오늘 날짜의 일정은 현재 시각이 지났어도 올해로 읽는다', () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00'));

    expect(toDateTimeLocal('10월 1일 (목) 09:00')).toBe('2026-10-01T09:00');
  });

  it('datetime-local 값은 문자열 맨 앞에서만 읽는다', () => {
    expect(fromDateTimeLocal('예정 2026-10-02T09:05')).toBe('');
    expect(fromDateTimeLocal('2026-10-02T09:05:30')).toBe('10월 2일 (금) 09:05');
  });

  it('일곱 요일을 모두 한국어 약자로 표시한다', () => {
    expect(
      [4, 5, 6, 7, 8, 9, 10].map((day) => fromDateTimeLocal(`2026-10-${String(day).padStart(2, '0')}T10:00`)),
    ).toEqual([
      '10월 4일 (일) 10:00',
      '10월 5일 (월) 10:00',
      '10월 6일 (화) 10:00',
      '10월 7일 (수) 10:00',
      '10월 8일 (목) 10:00',
      '10월 9일 (금) 10:00',
      '10월 10일 (토) 10:00',
    ]);
  });
});
