const MAP_INTRO_SEEN_KEY = 'jachwi:records-map-intro-seen';
const MAP_INTRO_HIDDEN_DAY_KEY = 'jachwi:records-map-intro-hidden-day';

const todayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};

/**
 * 본 방 기록 지도의 첫 진입 안내를 지금 띄우지 않을지.
 * `닫기`로 닫았거나 오늘 하루 보지 않기를 눌렀으면 띄우지 않는다. 저장소를 못 쓰면 매번 띄우지 않는다.
 */
export const hasSeenRecordsMapIntro = (): boolean => {
  try {
    return (
      localStorage.getItem(MAP_INTRO_SEEN_KEY) === 'true' ||
      localStorage.getItem(MAP_INTRO_HIDDEN_DAY_KEY) === todayKey()
    );
  } catch {
    return true;
  }
};

/** `닫기`: 다시 띄우지 않는다. */
export const markRecordsMapIntroSeen = () => {
  try {
    localStorage.setItem(MAP_INTRO_SEEN_KEY, 'true');
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 닫는다.
  }
};

/** `오늘 하루 보지 않기`: 내일 다시 띄운다. */
export const hideRecordsMapIntroToday = () => {
  try {
    localStorage.setItem(MAP_INTRO_HIDDEN_DAY_KEY, todayKey());
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 닫는다.
  }
};
