import RailCard from '../rail-card/RailCard';

import styles from './RankedCard.module.css';

export type CardRank = 1 | 2 | 3 | 4 | 5;
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
      <span className={styles.rank} aria-hidden="true">
        {rank}
      </span>
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
