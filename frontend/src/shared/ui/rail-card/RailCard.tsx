import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import styles from './RailCard.module.css';

type RailCardBaseProps = {
  /** 카드 안의 내용. 모양(테두리·배경·여백·너비)은 내용을 그리는 쪽이 `className`으로 정한다. */
  children: ReactNode;
  'aria-label'?: string;
  className?: string;
};

/** 다른 화면으로 이동하는 카드. 이동하면서 넘길 라우터 상태가 있으면 `state`에 준다. */
type RailCardLinkProps = { to: string; state?: unknown; onSelect?: never; selected?: never; disabled?: never };
/** 지금 화면에서 하나를 고르는 카드. 고른 카드는 `selected`로 표시하고 화면 낭독기에 눌림 상태로 알린다. */
type RailCardSelectProps = { to?: never; state?: never; onSelect: () => void; selected?: boolean; disabled?: boolean };

type RailCardProps = RailCardBaseProps & (RailCardLinkProps | RailCardSelectProps);

/**
 * `HorizontalRail`에 넣는 카드의 동작만 맡는 틀. 이동이면 링크를, 선택이면 눌림 상태가 있는 버튼을 그리고,
 * 포커스·눌림·선택·비활성 상태를 같은 방식으로 보여준다. 끌어서 넘길 때 클릭이 눌리지 않게 하는 처리는 레일이 맡는다.
 */
const RailCard = ({ children, 'aria-label': ariaLabel, className, ...action }: RailCardProps) => {
  const classes = `${styles.card} ${className ?? ''}`.trim();

  if (action.to !== undefined) {
    return (
      <Link className={classes} to={action.to} state={action.state} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      aria-label={ariaLabel}
      aria-pressed={action.selected ?? false}
      disabled={action.disabled}
      onClick={action.onSelect}
    >
      {children}
    </button>
  );
};

export default RailCard;
