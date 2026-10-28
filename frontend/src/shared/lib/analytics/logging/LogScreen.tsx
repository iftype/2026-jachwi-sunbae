import { type ReactNode, useEffect, useRef } from 'react';

import { type LogParams, LogParamsProvider } from './LogParamsContext';
import useLogger from './useLogger';

type LogScreenProps = {
  event: string;
  params?: LogParams;
  children: ReactNode;
};

/** 화면 진입 이벤트를 마운트 시 한 번 보내고, 같은 속성을 하위 로그에 내려준다. */
const LogScreen = ({ event, params, children }: LogScreenProps) => {
  const { log } = useLogger();
  const latest = useRef({ log, event, params });
  latest.current = { log, event, params };

  useEffect(() => {
    const { log: logScreen, event: screenEvent, params: screenParams } = latest.current;
    logScreen(screenEvent, screenParams);
  }, []);

  return <LogParamsProvider params={params}>{children}</LogParamsProvider>;
};

export default LogScreen;
