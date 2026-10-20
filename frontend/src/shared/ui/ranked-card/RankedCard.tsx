import rank1 from '@/shared/assets/illustrations/rank-1.webp';
import rank2 from '@/shared/assets/illustrations/rank-2.webp';
import rank3 from '@/shared/assets/illustrations/rank-3.webp';
import rank4 from '@/shared/assets/illustrations/rank-4.webp';
import rank5 from '@/shared/assets/illustrations/rank-5.webp';

import RailCard from '../rail-card/RailCard';

import styles from './RankedCard.module.css';

export type CardRank = 1 | 2 | 3 | 4 | 5;

/** 순위 숫자 대신 보여 주는 3D 리본 메달 이미지. */
const RANK_IMAGES: Record<CardRank, string> = { 1: rank1, 2: rank2, 3: rank3, 4: rank4, 5: rank5 };
export type RankedCardProps = {
  rank: CardRank;
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  className?: string;
};

const RankedCard = ({
  rank,
  title,
  value,
  unit = '',
  description,
  selected = false,
  disabled = false,
  onSelect,
  className,
}: RankedCardProps) => (
  <RailCard
    className={`${styles.card} ${className ?? ''}`.trim()}
    aria-label={`${rank}위 ${title} ${value}${unit}${description ? ` ${description}` : ''}`}
    selected={selected}
    disabled={disabled}
    onSelect={onSelect}
  >
    <span className={styles.heading}>
      <img className={styles.rank} src={RANK_IMAGES[rank]} alt="" width={96} height={96} aria-hidden="true" />
      <span className={styles.title}>{title}</span>
    </span>
    <strong className={styles.value}>
      {value}
      {unit && <span>{unit}</span>}
    </strong>
    {description && <span className={styles.description}>{description}</span>}
  </RailCard>
);

export default RankedCard;
