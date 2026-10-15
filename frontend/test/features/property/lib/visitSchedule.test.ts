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
