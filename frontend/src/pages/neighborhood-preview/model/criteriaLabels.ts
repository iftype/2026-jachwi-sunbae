import type { CommuteArea } from '@/features/map/api/commuteApi';

/** 고를 수 있는 월세 상한(만원). 0은 전체 가격이다. 자취방 월세 범위를 넘는 큰 값은 두지 않는다. */
export const RENT_LIMITS = [0, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150] as const;
export const isRentLimit = (value: unknown): value is number =>
  typeof value === 'number' && (RENT_LIMITS as readonly number[]).includes(value);
export const transferLabel = (maxTransfers: number) =>
  maxTransfers === 0 ? '환승 없음' : `환승 ${maxTransfers}회 이하`;
export const rentLabel = (maxRent: number) => (maxRent === 0 ? '월세 전체' : `월세 ${maxRent}만원 이하`);
/** 월세 조건 밖(지도의 회색) 동네를 골랐을 때의 안내. 조건 안이면 없다. */
export const overRentNotice = (rent: CommuteArea['rent'], maxRent: number) =>
  maxRent > 0 && rent && rent.monthlyRentKrw > maxRent * 10000 ? `월세 조건(${maxRent}만원 이하)보다 비싸요` : null;
export const emptyAreaMessage = (maxRent: number) =>
  maxRent === 0
    ? '조건에 맞는 동네가 없어요. 통근 시간이나 환승 조건을 넓혀보세요.'
    : '조건에 맞는 동네가 없어요. 월세 조건을 넓혀보세요.';
/** 휴대폰 결과 머리의 조건 요약 한 줄. 예: `통근 40분 · 환승 1회 · 월세 전체`. */
export const criteriaSummary = ({
  maxMinutes,
  maxTransfers,
  maxRent,
}: {
  maxMinutes: number;
  maxTransfers: number;
  maxRent: number;
}) =>
  [
    `통근 ${maxMinutes}분`,
    maxTransfers === 0 ? '환승 없음' : `환승 ${maxTransfers}회`,
    maxRent === 0 ? '월세 전체' : `월세 ${maxRent}만원`,
  ].join(', ');

/** 헤더 카드에 값으로 보여 줄 조건. 슬라이더는 막대만 두고, 월세 값은 여기서 바뀐다. */
export const criteriaItems = ({
  maxMinutes,
  maxTransfers,
  maxRent,
}: {
  maxMinutes: number;
  maxTransfers: number;
  maxRent: number;
}) => [
  { label: '통근', value: `${maxMinutes}분` },
  { label: '환승', value: maxTransfers === 0 ? '없음' : `${maxTransfers}회` },
  { label: '월세', value: maxRent === 0 ? '전체' : `${maxRent}만` },
];

const WON_PER_MANWON = 10_000;

/** 월세 시세를 `55 / 3,000`처럼 월세와 보증금(만원)만 슬래시로 이어 보여 준다. */
export const formatRentPair = (rent: { monthlyRentKrw: number; depositKrw: number }): string =>
  `${Math.round(rent.monthlyRentKrw / WON_PER_MANWON).toLocaleString('ko-KR')} / ${Math.round(rent.depositKrw / WON_PER_MANWON).toLocaleString('ko-KR')}`;
