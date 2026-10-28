// PR #432의 응답 DTO 중 생활 날씨 카드가 쓰는 부분.
export type WeatherHour = {
  forecastAt: string;
  publishedAt: string | null;
  tmp: number | null;
  sky: number | null;
  pty: number | null;
  pop: number | null;
  pcp: number | null;
  sno: number | null;
  reh: number | null;
  wsd: number | null;
};

export type WeatherForecastResponse = {
  gridX: number;
  gridY: number;
  date: string;
  timeZone: 'Asia/Seoul';
  hourly: WeatherHour[];
  tmn: number | null;
  tmx: number | null;
  tmnPublishedAt: string | null;
  tmxPublishedAt: string | null;
};

export type WeatherNotificationSettingsResponse = { enabled: boolean };
