/** 동네 찾기 주소에 골라 둔 내 매물 번호를 싣는 쿼리 이름. 새로고침과 뒤로가기가 이 선택을 되살린다. */
export const FINDER_PROPERTY_PARAM = 'property';
/** 값이 `detail`이면 골라 둔 매물의 상세를 옆 칸에 연다. 내 기록의 `view` 쿼리와 겹치지 않게 따로 둔다. */
export const FINDER_PROPERTY_VIEW_PARAM = 'propertyView';
export const FINDER_PROPERTY_DETAIL = 'detail';
/** 요약에서 상세로 넘어갈 때 기록에 남기는 표시. 상세의 뒤로가기는 이 표시가 있으면 브라우저 뒤로가기와 같게 한다. */
export const FINDER_FROM_SUMMARY_STATE = { finderSummary: true } as const;

export const parseFinderPropertyId = (value: string | null): number | null => {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

export const cameFromFinderSummary = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'finderSummary' in state && state.finderSummary === true;
