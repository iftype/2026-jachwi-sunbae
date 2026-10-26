export type DetailTab = 'details' | 'checklist';

/** 주소(`?tab=`)가 정하는 탭. 체크리스트에서 뒤로 돌아오면 그때 보던 탭으로 열린다. */
export const DETAIL_TAB_PARAM = 'tab';
const LAST_TAB_KEY = 'jachwi:property-detail-tab';

export const parseDetailTab = (value: string | null): DetailTab | null =>
  value === 'details' || value === 'checklist' ? value : null;

/** 주소에 탭이 없을 때(리스트에서 매물을 새로 열 때 등) 같은 탭에서 마지막으로 본 탭을 쓴다. */
export const readLastDetailTab = (): DetailTab => {
  try {
    return parseDetailTab(sessionStorage.getItem(LAST_TAB_KEY)) ?? 'details';
  } catch {
    return 'details';
  }
};

export const writeLastDetailTab = (tab: DetailTab) => {
  try {
    sessionStorage.setItem(LAST_TAB_KEY, tab);
  } catch {
    // 저장소를 쓸 수 없으면 주소만으로 기억한다.
  }
};
