// 지도 배경이 바뀌어도 이 팔레트만 바꾸면 구역·범례 색이 함께 바뀐다.
export const COMMUTE_COLORS = {
  fast: { fillColor: '#00AFFF', strokeColor: '#52D9FF', glowColor: '#00AFFF' },
  medium: { fillColor: '#00E58B', strokeColor: '#68FFB7', glowColor: '#00E58B' },
  slow: { fillColor: '#FF315A', strokeColor: '#FF829A', glowColor: '#FF315A' },
};

export const commuteColor = (minutes: number, maxMinutes: number) =>
  minutes <= maxMinutes / 3
    ? COMMUTE_COLORS.fast
    : minutes <= (maxMinutes * 2) / 3
      ? COMMUTE_COLORS.medium
      : COMMUTE_COLORS.slow;
