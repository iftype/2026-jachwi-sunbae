import { http, HttpResponse } from 'msw';

import { success } from '../mockStore';

const KST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 맑은 날 하루 예보. 06시 최저 16℃, 15시 최고 23℃로 오르내린다. */
export const createMockWeatherForecast = (date: string) => {
  const publishedAt = `${date}T05:00:00+09:00`;
  return {
    gridX: 60,
    gridY: 127,
    date,
    timeZone: 'Asia/Seoul',
    tmn: 16,
    tmx: 23,
    tmnPublishedAt: publishedAt,
    tmxPublishedAt: publishedAt,
    hourly: Array.from({ length: 24 }, (_, hour) => {
      const warmth = hour <= 6 ? (6 - hour) / 12 : hour <= 15 ? (hour - 6) / 9 : (24 - hour) / 9;
      return {
        forecastAt: `${date}T${String(hour).padStart(2, '0')}:00:00+09:00`,
        publishedAt,
        tmp: Math.round(16 + 7 * warmth),
        sky: 1,
        pty: 0,
        pop: 0,
        pcp: 0,
        sno: 0,
        reh: 60,
        wsd: 1.8,
      };
    }),
  };
};

// 로컬 목의 수신 동의. 새로고침하면 꺼진 상태로 돌아간다.
let notificationEnabled = false;

export const weatherHandlers = [
  http.get('*/api/weather/forecasts', ({ request }) => {
    const date = new URL(request.url).searchParams.get('date') ?? KST_DATE.format(new Date());
    return success(createMockWeatherForecast(date));
  }),
  http.get('*/api/members/me/weather-notification-settings', () => success({ enabled: notificationEnabled })),
  http.put('*/api/members/me/weather-notification-settings', async ({ request }) => {
    const body = (await request.json()) as { enabled?: unknown };
    notificationEnabled = body.enabled === true;
    return success({ enabled: notificationEnabled });
  }),
  http.put('*/api/members/me/weather-location', () =>
    success({ available: true, gridX: 60, gridY: 127, updatedAt: new Date().toISOString() }),
  ),
  http.delete('*/api/members/me/weather-location', () => new HttpResponse(null, { status: 204 })),
];
