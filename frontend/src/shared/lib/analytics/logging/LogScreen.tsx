import { type ReactNode, useEffect, useRef } from 'react';

import { type LogParams, LogParamsProvider } from './LogParamsContext';
import useLogger from './useLogger';

type LogScreenProps = {
  event: string;
  params?: LogParams;
  children: ReactNode;
};

/**
 * 화면 진입 이벤트를 마운트 시 한 번 보내고, 같은 속성을 하위 로그에 내려준다.
 * StrictMode의 effect 중복 실행은 기록하지 않는다. 같은 라우트에서 대상만 바뀔 때 다시 기록하려면 key를 바꾼다.
 */
const LogScreen = ({ event, params, children }: LogScreenProps) => {
  const { log } = useLogger();
  const tracked = useRef(false);
  const latest = useRef({ log, event, params });
  latest.current = { log, event, params };

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const { log: logScreen, event: screenEvent, params: screenParams } = latest.current;
    logScreen(screenEvent, screenParams);
  }, []);

  return <LogParamsProvider params={params}>{children}</LogParamsProvider>;
};

export default LogScreen;
