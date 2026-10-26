// PR #432 (fc812f9)의 응답 DTO. 위치 이름은 API 필드가 아닌 시연용 표시 정보다.
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

export type WeatherLocationResponse = {
  available: boolean;
  gridX: number | null;
  gridY: number | null;
  updatedAt: string | null;
};

export type WeatherNotificationSettingsResponse = { enabled: boolean };
export type WeatherDeviceResponse = { installationId: string; updatedAt: string };
export type WeatherCondition = 'SNOW' | 'RAIN' | 'FREEZE' | 'TEMPERATURE_SWING' | 'LAUNDRY';
export type NotificationSlot = 'MORNING' | 'EVENING';
export type WeatherNotificationResponse = {
  notificationId: string;
  sendDate: string;
  slot: NotificationSlot;
  targetDate: string;
  gridX: number;
  gridY: number;
  title: string;
  body: string;
  notices: Array<{ condition: WeatherCondition; message: string }>;
};

export type WeatherApiResponse<T> = { code: string; message: string; data: T };
export type WeatherScenario = 'sunny' | 'rain' | 'snow' | 'swing' | 'laundry' | 'empty';
export type LocationChoice = 'unknown' | 'allowed' | 'denied';
