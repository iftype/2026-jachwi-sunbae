import { Children, cloneElement, isValidElement, type MouseEvent, type ReactElement } from 'react';

import type { LogParams } from './LogParamsContext';
import useLogger from './useLogger';

type ClickableProps = { onClick?: (event: MouseEvent<HTMLElement>) => void };

type LogClickProps = {
  event: string;
  params?: LogParams;
  children: ReactElement<ClickableProps>;
};

/** 자식 하나의 onClick을 감싸 클릭 이벤트를 보낸 뒤 원래 핸들러를 실행한다. DOM을 추가로 만들지 않는다. */
const LogClick = ({ event, params, children }: LogClickProps) => {
  const { log } = useLogger();
  const child = Children.only(children);
  if (!isValidElement<ClickableProps>(child)) return child;

  return cloneElement(child, {
    onClick: (clickEvent: MouseEvent<HTMLElement>) => {
      log(event, params);
      child.props.onClick?.(clickEvent);
    },
  });
};

export default LogClick;
