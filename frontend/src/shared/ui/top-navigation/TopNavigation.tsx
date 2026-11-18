import { css, cx } from '@emotion/css';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { HOME_PATH } from '@/shared/lib/navigation/appPaths';

import Icon from '../icon/Icon';

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
          <Link
            className={styles.backLink}
            to={backPath}
            aria-label={backLabel}
            data-home-back={backPath === HOME_PATH || undefined}
          >
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

const styles = {
  // 다른 요소의 선택자에서 `.TopNavigation-root`로 가리킨다.
  root: cx(
    css`
      label: TopNavigation-root;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      min-height: var(--app-bar-height);
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.55rem;

      &[data-has-back='true'] {
        position: relative;
      }
    `,
    'TopNavigation-root',
  ),

  title: css`
    label: TopNavigation-title;

    .TopNavigation-root[data-has-back='true'] & {
      position: absolute;
      left: 50%;
      width: min(60%, 14rem);
      transform: translateX(-50%);
      font-size: 0.98rem;
      text-align: center;
      pointer-events: none;
    }

    & {
      min-width: 0;
      margin: 0;
      overflow: hidden;
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.3;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,

  leading: css`
    label: TopNavigation-leading;
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.45rem;
  `,

  backLink: css`
    label: TopNavigation-backLink;
    display: inline-grid;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    margin-left: -0.55rem;
    padding: 0;

    /* 휴대폰 하단 탭이 있으면 홈으로 가는 "<"는 탭과 겹치므로 숨긴다. 탭이 숨는 화면에서는 그대로 보인다. */
    html[data-mobile-tabs='on'] &[data-home-back='true'] {
      display: none;
    }
    border: 0;
    background: transparent;
    color: var(--color-ink);
    cursor: pointer;
    place-items: center;
    text-decoration: none;
  `,

  meta: css`
    label: TopNavigation-meta;
    flex: 0 0 auto;
    color: var(--color-muted);
    font-size: 0.74rem;
    font-weight: 700;
  `,

  endSlot: css`
    label: TopNavigation-endSlot;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.45rem;
  `,
};

export default TopNavigation;
