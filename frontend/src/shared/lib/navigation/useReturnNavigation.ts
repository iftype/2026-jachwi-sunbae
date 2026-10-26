import { type To, useLocation, useNavigate } from 'react-router-dom';

type ReturnNavigationOptions = {
  /** 바로 이전 기록이 돌아갈 화면이면 true. 이때는 기록을 쌓지 않고 뒤로 간다. */
  cameFromTarget: boolean;
  /** 이전 기록이 없을 때(주소 직접 입력 등) 지금 기록을 바꿔 이동할 화면. */
  fallback: To;
  fallbackState?: unknown;
};

/**
 * 화면 안 뒤로가기 버튼을 브라우저 뒤로가기와 같게 만든다.
 * 돌아갈 화면으로 새로 이동하면 기록이 계속 쌓여 휴대폰 뒤로가기를 여러 번 눌러야 하고, 이전 화면의 탭 상태도 잃는다.
 */
const useReturnNavigation = ({ cameFromTarget, fallback, fallbackState }: ReturnNavigationOptions) => {
  const navigate = useNavigate();
  const location = useLocation();
  // 첫 기록(`default`)이면 앱 안에서 돌아갈 곳이 없다.
  const canGoBack = cameFromTarget && location.key !== 'default';
  return () => {
    if (canGoBack) void navigate(-1);
    else void navigate(fallback, { replace: true, state: fallbackState });
  };
};

export default useReturnNavigation;
