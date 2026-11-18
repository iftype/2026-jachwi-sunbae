const BOOKMARK_LAYER_KEY = 'jachwi:records-bookmark-layer-rail';

/** 내 기록 지도에 북마크한 동네를 칠할지. 한 번 켜면 다음에 열어도 켜진 채로 둔다. */
export const readBookmarkLayerOn = (): boolean => {
  try {
    return localStorage.getItem(BOOKMARK_LAYER_KEY) === 'on';
  } catch {
    return false;
  }
};

export const writeBookmarkLayerOn = (isOn: boolean) => {
  try {
    localStorage.setItem(BOOKMARK_LAYER_KEY, isOn ? 'on' : 'off');
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 켜고 끈다.
  }
};
