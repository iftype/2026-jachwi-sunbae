import type { WeatherHour } from '../model/weather';

const WEATHER_TIME_ZONE = 'Asia/Seoul';

export const forecastHour = (at: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: WEATHER_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(
    new Date(at),
  );

export const weatherValue = (value: number | null, unit: string) => (value === null ? '정보 없음' : `${value}${unit}`);

const skyLabel = (sky: number | null) => ({ 1: '맑음', 3: '구름 많음', 4: '흐림' })[sky ?? -1] ?? '정보 없음';
const precipitationLabel = (pty: number | null) =>
  ({ 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' })[pty ?? -1] ?? '정보 없음';
export const weatherLabel = (hour: WeatherHour) =>
  hour.pty !== null && hour.pty !== 0 ? precipitationLabel(hour.pty) : skyLabel(hour.sky);
