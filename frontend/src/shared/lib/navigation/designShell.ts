const DESIGN_SHELL_KEY = 'jachwi:design-shell';

export const DESIGN_HOME_PATH = '/design-preview';
export const DESIGN_RECORDS_PATH = '/design-preview/records';

/**
 * 카드형 홈 시안에서 기존 화면으로 이동해도 같은 탭에서는 시안 셸(바텀탭 없음, 홈 버튼)을 유지한다.
 * 기존 화면의 내부 링크가 절대 경로를 쓰므로 경로 대신 세션 플래그로 구분한다.
 */
export const enterDesignShell = () => {
  try {
    sessionStorage.setItem(DESIGN_SHELL_KEY, 'true');
  } catch {
    // 저장소를 쓸 수 없으면 기존 셸로 보인다.
  }
};

export const isDesignShell = () => {
  try {
    return sessionStorage.getItem(DESIGN_SHELL_KEY) === 'true';
  } catch {
    return false;
  }
};
