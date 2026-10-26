export type RecordsView = 'map' | 'list';

/** 주소(`?view=`)가 정하는 보기 방식. 뒤로가기로 돌아오면 그때 보던 보기로 열린다. */
export const RECORDS_VIEW_PARAM = 'view';
const LAST_VIEW_KEY = 'jachwi:records-view';

export const parseRecordsView = (value: string | null): RecordsView | null =>
  value === 'map' || value === 'list' ? value : null;

/** 주소에 보기 방식이 없을 때(홈·삭제 뒤 이동 등) 같은 탭에서 마지막으로 고른 보기를 쓴다. */
export const readLastRecordsView = (): RecordsView => {
  try {
    return parseRecordsView(sessionStorage.getItem(LAST_VIEW_KEY)) ?? 'map';
  } catch {
    return 'map';
  }
};

export const writeLastRecordsView = (view: RecordsView) => {
  try {
    sessionStorage.setItem(LAST_VIEW_KEY, view);
  } catch {
    // 저장소를 쓸 수 없으면 주소만으로 기억한다.
  }
};
