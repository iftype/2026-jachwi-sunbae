import { type CommuteArea, formatManwon } from '@/features/map/api/commuteApi';

export const transferLabel = (maxTransfers: number) =>
  maxTransfers === 0 ? '환승 없음' : `환승 ${maxTransfers}회 이하`;
export const rentLabel = (maxRent: number) => (maxRent === 0 ? '월세 전체' : `월세 ${maxRent}만원 이하`);
export const emptyAreaMessage = (maxRent: number) =>
  maxRent === 0 ? '조건에 맞는 동네가 없어요.' : '조건에 맞는 동네가 없어요. 월세 조건을 넓혀보세요.';
/** 동네 카드 설명. 시세가 없는 동네도 통근 결과에는 남기므로 "시세 없음"으로 적는다. */
export const areaCardDescription = (area: { rent: CommuteArea['rent']; stations: { stopName: string }[] }) =>
  `${area.rent ? `월세 ${formatManwon(area.rent.monthlyRentKrw)}` : '시세 없음'} · ${area.stations[0].stopName}에서 출발`;
/** 결과 지도 위 안내. 가까이 보면 정류장·부동산·거리 메모를 올리고, 동네 안을 찍어 메모를 남길 수 있다. */
export const placesHint = ({ isClose, failed }: { isClose: boolean; failed: boolean }) =>
  !isClose
    ? '동네를 고르거나 가까이 확대하면 정류장·부동산·메모가 보여요'
    : failed
      ? '주변 정보를 일부 불러오지 못했어요'
      : '마커를 눌러 정보를 보고, 고른 동네 안을 눌러 메모를 남겨요';
