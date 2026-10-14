// 지도 배경이 바뀌어도 이 팔레트만 바꾸면 구역·범례 색이 함께 바뀐다.
export const COMMUTE_COLORS = {
  fast: { fillColor: '#168BFF', strokeColor: '#0875E1', glowColor: '#168BFF' },
  medium: { fillColor: '#12BC67', strokeColor: '#07964D', glowColor: '#12BC67' },
  slow: { fillColor: '#FF4058', strokeColor: '#E32642', glowColor: '#FF4058' },
};

export const commuteColor = (minutes: number, maxMinutes: number) =>
  minutes <= maxMinutes / 3
    ? COMMUTE_COLORS.fast
    : minutes <= (maxMinutes * 2) / 3
      ? COMMUTE_COLORS.medium
      : COMMUTE_COLORS.slow;
