import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import WeatherNoticePreview from '@/features/weather/ui/weather-notice-preview/WeatherNoticePreview';

const morningMessages = [
  '오늘 비 예보가 있어요. 우산을 챙기세요!',
  '오늘 눈이 예상돼요. 이동할 때 주의하세요!',
  '오늘 영하 5℃ 이하 추위가 예상돼요. 수도관 보온을 점검하세요!',
  '오늘 일교차가 10℃ 이상이에요. 겉옷을 챙기세요!',
  '오늘은 비 예보가 없고 습도가 낮아요. 빨래하기 괜찮겠어요!',
];
const eveningMessages = [
  '내일 비 예보가 있어요. 우산을 챙기세요!',
  '내일 눈이 예상돼요. 이동할 때 주의하세요!',
  '내일 영하 5℃ 이하 추위가 예상돼요. 수도관 보온을 점검하세요!',
  '내일 일교차가 10℃ 이상이에요. 겉옷을 챙기세요!',
  '내일은 비 예보가 없고 습도가 낮아요. 빨래하기 괜찮겠어요!',
];

const expectMessages = (messages: string[]) => {
  const list = screen.getByRole('list', { name: '생활 날씨 알림 문구 예시' });
  const rows = within(list).getAllByRole('listitem');
  expect(rows).toHaveLength(5);
  rows.forEach((row, index) => expect(within(row).getByText(messages[index], { exact: true })).toBeInTheDocument());
};

describe('생활 날씨 알림 문구 미리보기', () => {
  it('위치나 API 상태 없이 기본 아침 문구 다섯 개와 독립적인 예시 안내를 표시한다', () => {
    render(<WeatherNoticePreview />);
    expect(screen.getByRole('heading', { name: '생활 날씨 알림 미리보기' })).toBeInTheDocument();
    expect(screen.getByText('알림 문구 예시 · 실제 날씨와 무관')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '오전 7시 · 오늘 날씨' })).toHaveAttribute('aria-pressed', 'true');
    expectMessages(morningMessages);
  });

  it('저녁 클릭과 아침 키보드 선택으로 모든 확정 문구를 바꾸며 빨래 조사를 유지한다', async () => {
    const user = userEvent.setup();
    render(<WeatherNoticePreview />);
    await user.click(screen.getByRole('button', { name: '오후 10시 · 내일 날씨' }));
    expect(screen.getByRole('button', { name: '오후 10시 · 내일 날씨' })).toHaveAttribute('aria-pressed', 'true');
    expectMessages(eveningMessages);
    morningMessages.forEach((message) => expect(screen.queryByText(message, { exact: true })).not.toBeInTheDocument());
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: '오전 7시 · 오늘 날씨' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expectMessages(morningMessages);
    eveningMessages.forEach((message) => expect(screen.queryByText(message, { exact: true })).not.toBeInTheDocument());
  });
});
