import type { ComponentType, MouseEvent } from 'react';

import type { LogParams } from './LogParamsContext';
import useLogger from './useLogger';

export type WithLogClickProps = {
  /** 넘기지 않으면 로그 없이 원래 컴포넌트처럼 동작한다. */
  logEvent?: string;
  logParams?: LogParams;
};

// 버튼·링크 등 요소마다 이벤트 타입이 달라 핸들러 인자는 좁히지 않는다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClickableProps = { onClick?: (event: MouseEvent<any>) => void };

/** UI 컴포넌트는 그대로 두고 클릭 로그 책임만 덧입힌다. 로그 관련 prop은 원본 컴포넌트에 전달하지 않는다. */
const withLogClick = <P extends ClickableProps>(Component: ComponentType<P>) => {
  const WithLogClick = ({ logEvent, logParams, ...props }: P & WithLogClickProps) => {
    const { log } = useLogger();
    const componentProps = props as P;
    if (logEvent === undefined) return <Component {...componentProps} />;

    const handleClick: ClickableProps['onClick'] = (event) => {
      log(logEvent, logParams);
      componentProps.onClick?.(event);
    };
    return <Component {...componentProps} onClick={handleClick} />;
  };
  WithLogClick.displayName = `withLogClick(${Component.displayName ?? Component.name ?? 'Component'})`;
  return WithLogClick;
};

export default withLogClick;
