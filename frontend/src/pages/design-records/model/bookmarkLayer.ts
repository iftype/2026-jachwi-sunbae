const BOOKMARK_LAYER_KEY = 'jachwi:records-bookmark-layer-rail';

/** 내 기록 지도에 북마크한 동네를 칠할지. 켜고 끈 값을 다음에 열어도 따르고, 고른 적이 없으면 `null`(기본 켬)이다. */
export const readBookmarkLayerOn = (): boolean | null => {
  try {
    const stored = localStorage.getItem(BOOKMARK_LAYER_KEY);
    return stored === null ? null : stored === 'on';
  } catch {
    return null;
  }
};

export const writeBookmarkLayerOn = (isOn: boolean) => {
  try {
    localStorage.setItem(BOOKMARK_LAYER_KEY, isOn ? 'on' : 'off');
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 켜고 끈다.
  }
};
