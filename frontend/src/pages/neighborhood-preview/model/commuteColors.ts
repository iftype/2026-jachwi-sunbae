// 지도 배경이 바뀌어도 이 팔레트만 바꾸면 구역·범례 색이 함께 바뀐다.
export const COMMUTE_COLORS = {
  fast: { fillColor: '#168BFF', strokeColor: '#0875E1' },
  medium: { fillColor: '#12BC67', strokeColor: '#07964D' },
  slow: { fillColor: '#FF4058', strokeColor: '#E32642' },
};

export type CommuteColorGroup = keyof typeof COMMUTE_COLORS;
/** 최대 통근 시간과 상관없는 고정 구간이다. 최대 시간이 짧으면 한두 색만 나온다. */
export const COMMUTE_BAND_LIMITS = { fast: 15, medium: 30 } as const;
const GROUPS: CommuteColorGroup[] = ['fast', 'medium', 'slow'];

/** 가까운 시간대가 0이다. 색과 지도에 그리는 순서가 같은 구간을 쓴다. */
export const commuteBand = (minutes: number) =>
  minutes <= COMMUTE_BAND_LIMITS.fast ? 0 : minutes <= COMMUTE_BAND_LIMITS.medium ? 1 : 2;

export const commuteColor = (minutes: number) => COMMUTE_COLORS[GROUPS[commuteBand(minutes)]];

/** 선택한 최대 시간 안에 들어오는 구간만 범례로 보여준다. */
export const commuteLegend = (maxMinutes: number): [CommuteColorGroup, string][] => {
  const { fast, medium } = COMMUTE_BAND_LIMITS;
  const rows: [CommuteColorGroup, string][] = [['fast', `${Math.min(fast, maxMinutes)}분 이하`]];
  if (maxMinutes > fast) rows.push(['medium', `${fast + 1}~${Math.min(medium, maxMinutes)}분`]);
  if (maxMinutes > medium) rows.push(['slow', `${medium + 1}~${maxMinutes}분`]);
  return rows;
};
