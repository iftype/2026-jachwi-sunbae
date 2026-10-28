// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { forecastHour, seoulDate, shiftDate, weatherValue } from '@/features/weather/lib/weatherPresentation';
import type { WeatherScenario } from '@/features/weather/model/weather';
import { createForecastFixture } from '@/features/weather/model/weatherFixtures';

const today = '2026-10-26';
const scenarios: WeatherScenario[] = ['sunny', 'rain', 'snow', 'swing', 'laundry'];

describe('생활 날씨 샘플 예보와 PR #432 계약', () => {
  it.each(scenarios)('%s의 오늘 예보는 조회 API와 같은 모양의 24시간 응답이다', (scenario) => {
    const envelope = createForecastFixture(scenario, today, 0);
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
    expect(data.date).toBe(today);
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
    expect(data.hourly.every((hour) => hour.tmp !== null && hour.pty !== null)).toBe(true);
  });

  it('예보 없음은 24개 null 슬롯을 유지한다', () => {
    const forecast = createForecastFixture('empty', today, 0).data;
    expect(forecast.hourly).toHaveLength(24);
    expect(
      forecast.hourly.every((hour) =>
        Object.entries(hour).every(([key, value]) => key === 'forecastAt' || value === null),
      ),
    ).toBe(true);
    expect(forecast.tmn).toBeNull();
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
