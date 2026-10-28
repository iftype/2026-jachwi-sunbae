import { Children, cloneElement, type MouseEvent, type ReactElement } from 'react';

import type { LogParams } from './LogParamsContext';
import useLogger from './useLogger';

type ClickableProps = { onClick?: (event: MouseEvent<HTMLElement>) => void };

type LogClickProps = {
  event: string;
  params?: LogParams;
  children: ReactElement<ClickableProps>;
};

/** HOC로 감싸기 애매한 일회성 요소용이다. 자식 하나의 onClick을 감싸 로그를 보낸 뒤 원래 핸들러를 실행한다. */
const LogClick = ({ event, params, children }: LogClickProps) => {
  const { log } = useLogger();
  const child = Children.only(children);

  return cloneElement(child, {
    onClick: (clickEvent: MouseEvent<HTMLElement>) => {
      log(event, params);
      child.props.onClick?.(clickEvent);
    },
  });
};

export default LogClick;
