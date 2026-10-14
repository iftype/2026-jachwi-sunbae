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
  <button
    type="button"
    className={`${styles.card} ${className ?? ''}`.trim()}
    aria-label={`${rank}위 ${title} ${value}${unit}${description ? ` ${description}` : ''}`}
    aria-pressed={selected}
    disabled={disabled}
    onClick={onSelect}
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
  </button>
);

export default RankedCard;
