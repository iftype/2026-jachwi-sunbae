import type { WeatherCondition } from './weather';

// 서로 다른 날씨 상황을 비교하는 확정 시연 문구. 백엔드 알림 fixture와 독립적이다.
export const weatherNoticeExamples: Array<{ condition: WeatherCondition; label: string; message: string }> = [
  { condition: 'RAIN', label: '비', message: '비 예보가 있어요. 우산을 챙기세요!' },
  { condition: 'SNOW', label: '눈', message: '눈이 예상돼요. 이동할 때 주의하세요!' },
  { condition: 'FREEZE', label: '추위·동파', message: '영하 5℃ 이하 추위가 예상돼요. 수도관 보온을 점검하세요!' },
  { condition: 'TEMPERATURE_SWING', label: '일교차', message: '일교차가 10℃ 이상이에요. 겉옷을 챙기세요!' },
  { condition: 'LAUNDRY', label: '빨래 추천', message: '비 예보가 없고 습도가 낮아요. 빨래하기 괜찮겠어요!' },
];
