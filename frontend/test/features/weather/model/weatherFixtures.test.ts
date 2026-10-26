// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { forecastHour, seoulDate, shiftDate, weatherValue } from '@/features/weather/lib/weatherPresentation';
import type { NotificationSlot, WeatherCondition, WeatherScenario } from '@/features/weather/model/weather';
import { createForecastFixture, createNotificationFixture } from '@/features/weather/model/weatherFixtures';

const today = '2026-10-26';
const cases: Array<[WeatherScenario, WeatherCondition[]]> = [
  ['sunny', []],
  ['rain', ['RAIN']],
  ['snow', ['SNOW', 'FREEZE']],
  ['swing', ['TEMPERATURE_SWING']],
  ['laundry', ['LAUNDRY']],
];

describe('날씨 프로토타입 fixture와 PR #432 계약', () => {
  it.each(cases)('%s의 오늘·내일은 실제 판정 조건과 같은 알림을 만든다', (scenario, expected) => {
    for (const slot of ['MORNING', 'EVENING'] as NotificationSlot[]) {
      const envelope = createForecastFixture(scenario, today, slot === 'MORNING' ? 0 : 1);
      expect(Object.keys(envelope).sort()).toEqual(['code', 'data', 'message']);
      const data = envelope.data;
      expect(Object.keys(data).sort()).toEqual([
        'date',
        'gridX',
        'gridY',
        'hourly',
        'timeZone',
        'tmn',
        'tmnPublishedAt',
        'tmx',
        'tmxPublishedAt',
      ]);
      expect(data.hourly).toHaveLength(24);
      expect(data.hourly.map((hour) => forecastHour(hour.forecastAt))).toEqual(
        Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')),
      );
      expect(Object.keys(data.hourly[0]).sort()).toEqual([
        'forecastAt',
        'pcp',
        'pop',
        'pty',
        'publishedAt',
        'reh',
        'sky',
        'sno',
        'tmp',
        'wsd',
      ]);
      const hours = data.hourly.slice(slot === 'MORNING' ? 7 : 0);
      expect(hours.every((hour) => hour.tmp !== null && hour.pty !== null)).toBe(true);
      // Java LifeWeatherRules의 경계와 독립적으로 fixture의 판정 결과를 대조한다.
      const actual: WeatherCondition[] = [];
      if (hours.some((hour) => hour.pty === 2 || hour.pty === 3)) actual.push('SNOW');
      if (hours.some((hour) => hour.pty === 1 || hour.pty === 2 || hour.pty === 4)) actual.push('RAIN');
      if (hours.some((hour) => hour.tmp !== null && hour.tmp <= -5) || (data.tmn !== null && data.tmn <= -5))
        actual.push('FREEZE');
      if (data.tmn !== null && data.tmx !== null && data.tmx - data.tmn >= 10) actual.push('TEMPERATURE_SWING');
      const daytime = data.hourly.slice(9, 19);
      if (
        daytime.every((hour) => hour.pty === 0 && hour.reh !== null) &&
        daytime.reduce((total, hour) => total + (hour.reh ?? 0), 0) / 10 <= 60
      )
        actual.push('LAUNDRY');
      expect(actual).toEqual(expected);
      const notification = createNotificationFixture(scenario, today, slot, 'sample-id');
      expect(notification?.notices.map((notice) => notice.condition)).toEqual(actual);
      expect(notification?.targetDate).toBe(slot === 'MORNING' ? today : '2026-10-27');
      expect(notification?.sendDate).toBe(today);
      expect(notification?.title.startsWith(slot === 'MORNING' ? '오늘 ' : '내일 ')).toBe(true);
    }
  });

  it('눈·추위는 실제 우선순위와 문자열로 제목·본문을 만든다', () => {
    const notification = createNotificationFixture('snow', today, 'MORNING', 'snow-id');
    expect(notification?.title).toBe('오늘 눈 예보가 있어요. 이동에 주의하세요');
    expect(notification?.body).toBe('오늘 추위 예보가 있어요. 노출된 수도관 보온을 점검하세요');
  });

  it('예보 없음은 24개 null 슬롯을 유지하고 알림을 만들지 않는다', () => {
    const forecast = createForecastFixture('empty', today, 0).data;
    expect(forecast.hourly).toHaveLength(24);
    expect(
      forecast.hourly.every((hour) =>
        Object.entries(hour).every(([key, value]) => key === 'forecastAt' || value === null),
      ),
    ).toBe(true);
    expect(forecast.tmn).toBeNull();
    expect(createNotificationFixture('empty', today, 'MORNING', 'empty-id')).toBeNull();
  });

  it('정상 0·영하·결측값을 구분하고 한국 시간 자정과 월말을 처리한다', () => {
    expect(weatherValue(0, ' mm')).toBe('0 mm');
    expect(weatherValue(-7, '°')).toBe('-7°');
    expect(weatherValue(null, '%')).toBe('정보 없음');
    expect(seoulDate(new Date('2026-10-26T15:00:00Z'))).toBe('2026-10-27');
    expect(forecastHour('2026-10-26T15:00:00Z')).toBe('00');
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01');
  });
});
