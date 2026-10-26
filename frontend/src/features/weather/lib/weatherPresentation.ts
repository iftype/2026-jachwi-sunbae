import type { WeatherHour } from '../model/weather';

export const WEATHER_TIME_ZONE = 'Asia/Seoul';

export const seoulDate = (now: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: WEATHER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00+09:00`);
  value.setUTCDate(value.getUTCDate() + days);
  return seoulDate(value);
};

export const forecastHour = (at: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: WEATHER_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(
    new Date(at),
  );

export const displayDate = (date: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: WEATHER_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T12:00:00+09:00`));

export const weatherValue = (value: number | null, unit: string) => (value === null ? '정보 없음' : `${value}${unit}`);

export const skyLabel = (sky: number | null) => ({ 1: '맑음', 3: '구름 많음', 4: '흐림' })[sky ?? -1] ?? '정보 없음';
export const precipitationLabel = (pty: number | null) =>
  ({ 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' })[pty ?? -1] ?? '정보 없음';
export const weatherLabel = (hour: WeatherHour) =>
  hour.pty !== null && hour.pty !== 0 ? precipitationLabel(hour.pty) : skyLabel(hour.sky);
