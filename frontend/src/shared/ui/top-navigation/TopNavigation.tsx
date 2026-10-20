import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import Icon from '../icon/Icon';

import styles from './TopNavigation.module.css';

type TopNavigationProps = {
  title: string;
  meta?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  backLabel?: string;
  navigationIcon?: 'arrow-left' | 'close';
  endSlot?: ReactNode;
  className?: string;
};

const TopNavigation = ({
  title,
  meta,
  backTo,
  onBack,
  backLabel = '뒤로 가기',
  navigationIcon = 'arrow-left',
  endSlot,
  className,
}: TopNavigationProps) => {
  const backPath = backTo;
  return (
    <header
      className={`${styles.root} ${className ?? ''}`}
      data-has-back={backTo !== undefined || onBack !== undefined ? 'true' : 'false'}
    >
      <div className={styles.leading}>
        {onBack !== undefined ? (
          <button className={styles.backLink} type="button" aria-label={backLabel} onClick={onBack}>
            <Icon name={navigationIcon} size={21} />
          </button>
        ) : backPath !== undefined ? (
          <Link className={styles.backLink} to={backPath} aria-label={backLabel}>
            <Icon name={navigationIcon} size={21} />
          </Link>
        ) : null}
        <h1 className={styles.title} title={title}>
          {title}
        </h1>
      </div>
      {(meta !== undefined || endSlot !== undefined) && (
        <div className={styles.endSlot}>
          {meta !== undefined && <span className={styles.meta}>{meta}</span>}
          {endSlot}
        </div>
      )}
    </header>
  );
};

export default TopNavigation;
