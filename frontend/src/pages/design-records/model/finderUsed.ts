const FINDER_USED_KEY = 'jachwi:finder-used';

/** 내 기록 지도 아래 동네 찾기 배너를, 동네 찾기를 한 번 써 본 사람에게는 더 이상 보이지 않게 할지. 끄려면 false. */
export const HIDE_FINDER_BANNER_AFTER_USE = true;

/** 동네 찾기 안내를 누르거나 동네 찾기 결과 지도를 한 번이라도 봤는지. 기기별로 저장한다. */
export const hasUsedFinder = (): boolean => {
  try {
    return localStorage.getItem(FINDER_USED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const markFinderUsed = () => {
  try {
    localStorage.setItem(FINDER_USED_KEY, 'true');
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 기억한다.
  }
};
