// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createMockWeatherForecast } from '@/app/mocks/handlers/weatherHandlers';
import { parseWeatherForecast } from '@/features/weather/api/weatherApi';
import { forecastHour, weatherLabel, weatherValue } from '@/features/weather/lib/weatherPresentation';

describe('날씨 조회 응답 해석', () => {
  it('PR #432의 조회 응답을 24시간 예보로 읽는다', () => {
    const forecast = parseWeatherForecast(createMockWeatherForecast('2026-10-26'));
    expect(forecast.date).toBe('2026-10-26');
    expect(forecast.hourly.map((hour) => forecastHour(hour.forecastAt))).toEqual(
      Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')),
    );
    expect(forecast.tmn).toBe(16);
    expect(forecast.tmx).toBe(23);
  });

  it('값이 없는 시각과 요소는 null로 읽는다', () => {
    const raw = createMockWeatherForecast('2026-10-26');
    const forecast = parseWeatherForecast({
      ...raw,
      tmn: null,
      tmnPublishedAt: null,
      hourly: raw.hourly.map((hour) => ({ ...hour, tmp: null, publishedAt: null })),
    });
    expect(forecast.tmn).toBeNull();
    expect(forecast.hourly.every((hour) => hour.tmp === null)).toBe(true);
  });

  it('숫자가 아닌 기온은 잘못된 응답으로 본다', () => {
    const raw = createMockWeatherForecast('2026-10-26');
    expect(() => parseWeatherForecast({ ...raw, tmx: '23' })).toThrow();
  });

  it('정상 0·영하·결측값을 구분하고 한국 시간 자정과 강수 형태를 표시한다', () => {
    expect(weatherValue(0, ' mm')).toBe('0 mm');
    expect(weatherValue(-7, '°')).toBe('-7°');
    expect(weatherValue(null, '%')).toBe('정보 없음');
    expect(forecastHour('2026-10-26T15:00:00Z')).toBe('00');
    expect(weatherLabel({ sky: 4, pty: 1 } as Parameters<typeof weatherLabel>[0])).toBe('비');
    expect(weatherLabel({ sky: 1, pty: 0 } as Parameters<typeof weatherLabel>[0])).toBe('맑음');
  });
});
