import type { ComponentType } from 'react';

import LogClick from './LogClick';
import type { LogParams } from './LogParamsContext';

export type WithLogClickProps = {
  /** 넘기지 않으면 로그 없이 원래 컴포넌트처럼 동작한다. */
  logEvent?: string;
  logParams?: LogParams;
};

/** UI 컴포넌트는 그대로 두고 클릭 로그 책임만 덧입힌다. 로그 관련 prop은 원본 컴포넌트에 전달하지 않는다. */
const withLogClick = <P extends object>(Component: ComponentType<P>) => {
  const WithLogClick = ({ logEvent, logParams, ...props }: P & WithLogClickProps) => {
    const element = <Component {...(props as P)} />;
    if (logEvent === undefined) return element;
    return (
      <LogClick event={logEvent} params={logParams}>
        {element}
      </LogClick>
    );
  };
  WithLogClick.displayName = `withLogClick(${Component.displayName ?? Component.name ?? 'Component'})`;
  return WithLogClick;
};

export default withLogClick;
