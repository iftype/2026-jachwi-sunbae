import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import Icon from '@/shared/ui/icon/Icon';
import SelectionControl from '@/shared/ui/selection-control/SelectionControl';

type CardContent = {
  title: string;
  description: string;
  /** 제목 줄 오른쪽 작은 칩. 예: `현재`, `방금 생성` */
  badge?: ReactNode;
};

type ChecklistBundleCardProps = CardContent &
  (
    | {
        /** 체크리스트 교체 화면처럼 하나를 고르는 카드. 왼쪽에 선택 표시가 붙는다. */
        kind: 'option';
        name: string;
        value: string;
        checked: boolean;
        disabled?: boolean;
        onSelect: () => void;
      }
    | {
        /** 관리 화면처럼 눌러서 그 체크리스트를 여는 카드. */
        kind: 'link';
        to: string;
        isCurrent?: boolean;
      }
    | {
        /** 누를 곳이 없는 읽기 전용 카드. */
        kind: 'static';
      }
  );

const Text = ({ title, description }: CardContent) => (
  <span className={styles.text}>
    <strong>{title}</strong>
    <small>{description}</small>
  </span>
);

/**
 * 체크리스트 묶음 한 장. 체크리스트 교체와 체크리스트 관리가 같은 모양을 쓰도록 카드 스타일을 이 한 곳에서 정의한다.
 * 테두리 없는 회색 라운드 카드이고, 고른 카드는 연한 파랑 바탕과 파란 체크로 알아본다.
 */
const ChecklistBundleCard = (props: ChecklistBundleCardProps) => {
  const text = <Text title={props.title} description={props.description} />;
  const badge = props.badge === undefined ? null : <em className={styles.badge}>{props.badge}</em>;

  if (props.kind === 'option')
    return (
      <SelectionControl
        className={styles.card}
        name={props.name}
        value={props.value}
        checked={props.checked}
        disabled={props.disabled}
        markClassName={styles.mark}
        onSelect={props.onSelect}
      >
        {text}
        {badge}
      </SelectionControl>
    );

  if (props.kind === 'link')
    return (
      <Link
        to={props.to}
        className={`${styles.card} ${styles.link}`}
        aria-current={props.isCurrent === true ? 'page' : undefined}
        data-selected={props.isCurrent === true || undefined}
      >
        <Icon name="checklist" size={20} />
        {text}
        {badge}
        <Icon name={props.isCurrent === true ? 'edit' : 'chevron-right'} size={16} />
      </Link>
    );

  return (
    <div className={`${styles.card} ${styles.static}`}>
      <Icon name="checklist" size={20} />
      {text}
      {badge}
    </div>
  );
};

const styles = {
  card: css`
    label: ChecklistBundleCard-card;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 4.5rem;
    padding: 0.9rem 1rem;
    border: 0;
    border-radius: 1rem;
    background: var(--color-card-surface);
    color: var(--color-ink);
    text-decoration: none;

    &[data-selected],
    &[aria-current='page'] {
      background: color-mix(in srgb, var(--color-brand-blue) 16%, white);
    }

    &:has(input:focus-visible),
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
  link: css`
    label: ChecklistBundleCard-link;
    cursor: pointer;
  `,
  static: css`
    label: ChecklistBundleCard-static;
    cursor: default;
  `,
  text: css`
    label: ChecklistBundleCard-text;
    flex: 1;
    min-width: 0;

    & strong,
    & small {
      display: block;
      overflow-wrap: anywhere;
    }
    & strong {
      font-size: 0.875rem;
      line-height: 1.4;
    }
    & small {
      margin-top: 0.1rem;
      color: var(--color-muted);
      font-size: 0.75rem;
    }
  `,
  badge: css`
    label: ChecklistBundleCard-badge;
    flex: none;
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-brand-blue) 22%, white);
    color: var(--color-brand-blue-ink);
    font-size: 0.7rem;
    font-style: normal;
    font-weight: 700;
  `,
  mark: css`
    label: ChecklistBundleCard-mark;
    display: grid;
    flex: none;
    box-sizing: border-box;
    width: 1.35rem;
    height: 1.35rem;
    border: 1.5px solid var(--color-border-strong);
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-on-card-accent);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
    place-items: center;

    [data-selected] > & {
      border-color: var(--color-brand-blue);
      background: var(--color-brand-blue);
    }
  `,
};

export default ChecklistBundleCard;
