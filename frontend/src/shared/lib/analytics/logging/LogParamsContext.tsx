import { createContext, type ReactNode, use, useMemo } from 'react';

export type LogParams = Record<string, unknown>;

const LogParamsContext = createContext<LogParams>({});

type LogParamsProviderProps = {
  params?: LogParams;
  children: ReactNode;
};

/** 하위 로그에 공통 속성을 내려준다. 중첩되면 바깥 속성 위에 안쪽 속성을 덮어쓴다. */
export const LogParamsProvider = ({ params, children }: LogParamsProviderProps) => {
  const parentParams = use(LogParamsContext);
  const mergedParams = useMemo(() => ({ ...parentParams, ...params }), [parentParams, params]);
  return <LogParamsContext value={mergedParams}>{children}</LogParamsContext>;
};

export const useLogParams = (): LogParams => use(LogParamsContext);
