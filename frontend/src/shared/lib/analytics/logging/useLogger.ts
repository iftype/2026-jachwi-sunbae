import { useCallback } from 'react';

import { trackPostHogEvent } from '../posthog';
import { type LogParams, useLogParams } from './LogParamsContext';

/** 상위 LogParamsProvider 속성을 합쳐 이벤트를 보낸다. 호출부 속성이 상위 속성보다 우선한다. */
const useLogger = () => {
  const contextParams = useLogParams();
  const log = useCallback(
    (eventName: string, params?: LogParams) => trackPostHogEvent(eventName, { ...contextParams, ...params }),
    [contextParams],
  );
  return { log };
};

export default useLogger;
