import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import styles from './ActionCard.module.css';

/** 카드 바탕색과 글자색. `brand`는 대표 행동, `informative`는 안내, `neutral`은 일반 기능에 쓴다. */
export type ActionCardTone = 'neutral' | 'brand' | 'informative';
/** 제목 크기. 한 화면의 대표 카드만 `large`로 둔다. */
export type ActionCardSize = 'medium' | 'large';
/** 그림이 카드에 놓이는 방식. `corner`는 오른쪽 아래 모서리에 걸치고, `peek`는 아래 가장자리에서 고개를 내민다. */
export type ActionCardIllustrationPlacement = 'corner' | 'peek';

type ActionCardBaseProps = {
  title: ReactNode;
  description?: ReactNode;
  tone?: ActionCardTone;
  size?: ActionCardSize;
  /** 카드 가장자리에 걸치는 그림. 보통 `ActionCardIllustration`을 넣고, 직접 만든 장면도 넣을 수 있다. */
  illustration?: ReactNode;
  /** 제목만으로 뜻이 부족할 때 쓰는 접근성 이름. */
  'aria-label'?: string;
  /** 크기·배치처럼 화면마다 다른 레이아웃만 덧붙인다. */
  className?: string;
};

type ActionCardProps = ActionCardBaseProps & ({ to: string; onClick?: never } | { to?: never; onClick?: () => void });

/**
 * 제목·설명과 3D 그림으로 기능을 안내하는 큰 카드. 화면 이동이면 `to`로 링크를, 동작이면 `onClick`으로 버튼을 그린다.
 * 마우스를 올리면 카드가 살짝 떠오르고, 그림은 놓인 방식에 맞게 움직인다.
 */
const ActionCard = ({
  title,
  description,
  tone = 'neutral',
  size = 'medium',
  illustration,
  'aria-label': ariaLabel,
  className,
  to,
  onClick,
}: ActionCardProps) => {
  const classes = [styles.card, styles[tone], styles[size], className].filter(Boolean).join(' ');
  const content = (
    <>
      <span className={styles.text}>
        <strong className={styles.title}>{title}</strong>
        {description && <small className={styles.description}>{description}</small>}
      </span>
      {illustration}
    </>
  );

  if (to !== undefined) {
    return (
      <Link className={classes} to={to} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} aria-label={ariaLabel} onClick={onClick}>
      {content}
    </button>
  );
};

type ActionCardIllustrationProps = {
  src: string;
  /** 원본 이미지 크기. 그려지는 크기는 `placement`가 정한다. */
  width: number;
  height: number;
  placement?: ActionCardIllustrationPlacement;
};

/** `ActionCard`의 `illustration`에 넣는 장식용 그림. 화면 낭독기는 읽지 않는다. */
export const ActionCardIllustration = ({ src, width, height, placement = 'corner' }: ActionCardIllustrationProps) => (
  <img className={`${styles.illustration} ${styles[placement]}`} src={src} alt="" width={width} height={height} />
);

export default ActionCard;
