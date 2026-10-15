const STORAGE_KEY = 'jachwi-analytics-test-traffic';

/** 테스트 기기에서 한 번 설정한다. 계정 권한 판정에는 사용하지 않는다. */
export const getAnalyticsTrafficContext = (environment?: string) => {
  let isTestDevice = false;
  if (typeof window !== 'undefined') {
    const requested = new URLSearchParams(window.location.search).get('analytics_test');
    isTestDevice = requested === '1';
    try {
      if (requested === '1') window.localStorage.setItem(STORAGE_KEY, '1');
      if (requested === '0') window.localStorage.removeItem(STORAGE_KEY);
      isTestDevice = requested === '1' || (requested !== '0' && window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // 저장소가 차단되어도 서비스 이용과 이벤트 전송은 계속한다.
    }
  }
  return { traffic_type: environment === 'development' ? 'development' : isTestDevice ? 'test' : 'external' };
};
