// PR #432 (fc812f9)의 응답 DTO 중 생활 날씨 카드가 쓰는 부분. 위치 이름은 API 필드가 아닌 표시 정보다.
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
export type WeatherApiResponse<T> = { code: string; message: string; data: T };
export type WeatherScenario = 'sunny' | 'rain' | 'snow' | 'swing' | 'laundry' | 'empty';
export type LocationChoice = 'unknown' | 'allowed' | 'denied';
/** 기기의 OS 알림 권한. iOS는 한 번 거부하면 앱에서 다시 물을 수 없어 설정 화면으로 안내한다. */
export type DevicePermission = 'unknown' | 'granted' | 'denied';
/** 푸시는 앱에서만 받을 수 있다. 실제 구현은 `window.__JACHWI_NATIVE_APP__` 존재 여부로 판단한다. */
export type ClientPlatform = 'app' | 'web';
