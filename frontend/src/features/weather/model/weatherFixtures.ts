import { shiftDate } from '../lib/weatherPresentation';
import type { WeatherApiResponse, WeatherForecastResponse, WeatherScenario } from './weather';

/** 실제 위치·예보 API를 연결하기 전까지 생활 날씨 카드가 쓰는 샘플 위치와 예보다. */
export const SAMPLE_LOCATION = '서울 시청';
const temperatureRanges: Record<WeatherScenario, [number, number]> = {
  sunny: [16, 23],
  rain: [13, 18],
  snow: [-7, 0],
  swing: [7, 22],
  laundry: [17, 25],
  empty: [0, 0],
};

export const createForecastFixture = (
  scenario: WeatherScenario,
  today: string,
  day: 0 | 1,
): WeatherApiResponse<WeatherForecastResponse> => {
  const date = shiftDate(today, day);
  const isEmpty = scenario === 'empty';
  const [low, high] = temperatureRanges[scenario];
  const offset = day * (scenario === 'rain' ? -1 : 1);
  const publishedAt = `${shiftDate(today, -1)}T23:00:00+09:00`;
  return {
    code: 'SUCCESS',
    message: '요청이 성공했습니다.',
    data: {
      gridX: 60,
      gridY: 127,
      date,
      timeZone: 'Asia/Seoul',
      tmn: isEmpty ? null : low + offset,
      tmx: isEmpty ? null : high + offset,
      tmnPublishedAt: isEmpty ? null : publishedAt,
      tmxPublishedAt: isEmpty ? null : publishedAt,
      hourly: Array.from({ length: 24 }, (_, hour) => {
        const isWet = (scenario === 'rain' || scenario === 'snow') && hour >= (day === 0 ? 9 : 11) && hour <= 18;
        // 06시 최저, 15시 최고. 내일은 강수 시작 시각과 기온도 바뀐다.
        const warmth = hour <= 6 ? (6 - hour) / 12 : hour <= 15 ? (hour - 6) / 9 : (24 - hour) / 9;
        return {
          forecastAt: `${date}T${String(hour).padStart(2, '0')}:00:00+09:00`,
          publishedAt: isEmpty ? null : publishedAt,
          tmp: isEmpty ? null : Math.round(low + (high - low) * warmth) + offset,
          sky: isEmpty ? null : scenario === 'rain' || scenario === 'snow' ? 4 : 1,
          pty: isEmpty ? null : isWet ? (scenario === 'snow' ? 3 : 1) : 0,
          pop: isEmpty ? null : isWet ? 90 : 0,
          // 03시에는 선택 요소만 결측: 0과 null을 화면에서 구별한다.
          pcp: isEmpty || hour === 3 ? null : isWet && scenario === 'rain' ? 2.5 : 0,
          sno: isEmpty || hour === 3 ? null : isWet && scenario === 'snow' ? 0.8 : 0,
          reh: isEmpty || hour === 3 ? null : scenario === 'laundry' ? 45 : isWet ? 85 : 68,
          wsd: isEmpty || hour === 3 ? null : hour === 0 ? 0 : isWet ? 3.2 : 1.8,
        };
      }),
    },
  };
};
