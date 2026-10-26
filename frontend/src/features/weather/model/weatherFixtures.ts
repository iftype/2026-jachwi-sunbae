import { forecastHour, shiftDate } from '../lib/weatherPresentation';
import type {
  NotificationSlot,
  WeatherApiResponse,
  WeatherCondition,
  WeatherForecastResponse,
  WeatherLocationResponse,
  WeatherNotificationResponse,
  WeatherScenario,
} from './weather';

export const SAMPLE_LOCATION = '서울 시청';
export const sampleLocation: WeatherLocationResponse = {
  available: true,
  gridX: 60,
  gridY: 127,
  updatedAt: '2026-10-26T06:00:00Z',
};

export const scenarioLabels: Record<WeatherScenario, string> = {
  sunny: '맑은 날',
  rain: '비 오는 날',
  snow: '눈·추위가 있는 날',
  swing: '일교차가 큰 날',
  laundry: '빨래하기 좋은 날',
  empty: '예보 데이터 없음',
};

export const conditionLabels: Record<WeatherCondition, string> = {
  SNOW: '눈',
  RAIN: '비',
  FREEZE: '추위·동파',
  TEMPERATURE_SWING: '일교차',
  LAUNDRY: '빨래 추천',
};

// LifeWeatherRules의 실제 문구와 우선순위. 서버 판정 로직을 제품 코드로 재구현하지 않는다.
export const noticeMessages: Record<WeatherCondition, string> = {
  SNOW: '눈 예보가 있어요. 이동에 주의하세요',
  RAIN: '비 예보가 있어요. 우산을 준비하세요',
  FREEZE: '추위 예보가 있어요. 노출된 수도관 보온을 점검하세요',
  TEMPERATURE_SWING: '일교차가 10℃ 이상이에요. 겉옷을 준비하세요',
  LAUNDRY: '09~18시 예보상 바깥 건조를 고려할 수 있어요',
};

const conditions: Record<WeatherScenario, WeatherCondition[]> = {
  sunny: [],
  rain: ['RAIN'],
  snow: ['SNOW', 'FREEZE'],
  swing: ['TEMPERATURE_SWING'],
  laundry: ['LAUNDRY'],
  empty: [],
};
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

/** 시연 버튼을 누른 순간 만든 DTO를 보관한다. 상세 화면은 이 함수를 호출하지 않는다. */
export const createNotificationFixture = (
  scenario: WeatherScenario,
  today: string,
  slot: NotificationSlot,
  notificationId: string,
): WeatherNotificationResponse | null => {
  if (scenario === 'empty') return null;
  const forecast = createForecastFixture(scenario, today, slot === 'MORNING' ? 0 : 1).data;
  const hours = forecast.hourly.filter((hour) => Number(forecastHour(hour.forecastAt)) >= (slot === 'MORNING' ? 7 : 0));
  const temperatures = hours.flatMap((hour) => (hour.tmp === null ? [] : [hour.tmp]));
  const notices = conditions[scenario].map((condition) => ({ condition, message: noticeMessages[condition] }));
  const prefix = slot === 'MORNING' ? '오늘 ' : '내일 ';
  const summary = `${slot === 'MORNING' ? '07' : '00'}~23시 예보기온 ${Math.min(...temperatures)}~${Math.max(...temperatures)}℃`;
  const secondNotice = notices[1];
  return {
    notificationId,
    sendDate: today,
    slot,
    targetDate: forecast.date,
    gridX: 60,
    gridY: 127,
    title: prefix + (notices[0]?.message ?? summary),
    body:
      secondNotice && secondNotice.condition !== 'LAUNDRY'
        ? prefix + secondNotice.message
        : '마지막으로 확인한 위치 기준이에요. 상세 날씨를 확인해 주세요.',
    notices,
  };
};
