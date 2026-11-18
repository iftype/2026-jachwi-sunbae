import { css, cx } from '@emotion/css';
import type { ReactNode } from 'react';

import { COMMUTE_COLORS, commuteLegend, NO_RENT_COLOR, NO_RENT_LEGEND_LABEL } from '../../model/commuteColors';

type Props = {
  maxMinutes: number;
  /** 항목 아래에 덧붙일 것(휴대폰의 `표 닫기` 버튼). */
  children?: ReactNode;
  className?: string;
};

/** 지도 색 기준 카드. 통근 시간 구간 색과 월세 정보 없음 항목을 세로로 쌓는다. 데스크탑과 휴대폰이 함께 쓴다. */
const CommuteLegend = ({ maxMinutes, children, className }: Props) => (
  <div className={cx(styles.card, className)} aria-label="통근 시간 색상 기준">
    {commuteLegend(maxMinutes).map(([group, label]) => (
      <span key={group}>
        <i style={{ background: COMMUTE_COLORS[group].fillColor }} />
        {label}
      </span>
    ))}
    <span>
      <i className={styles.noRentSwatch} style={{ borderColor: NO_RENT_COLOR.strokeColor }} />
      {NO_RENT_LEGEND_LABEL}
    </span>
    {children}
  </div>
);

const styles = {
  card: css`
    label: CommuteLegend-card;
    pointer-events: auto;
    display: grid;
    flex: none;
    gap: 0.2rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.9rem;
    background: var(--color-surface);
    box-shadow: 0 1px 6px rgb(0 0 0 / 8%);
    color: var(--color-ink-soft);
    font-size: 0.68rem;
    font-weight: 700;
    white-space: nowrap;

    & span {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    & i {
      width: 3px;
      height: 0.62rem;
      flex: none;
      border-radius: 1px;
    }
  `,
  noRentSwatch: css`
    label: CommuteLegend-noRentSwatch;
    &&& {
      width: 0.62rem;
      height: 0.62rem;
      box-sizing: border-box;
      border: 1.5px dashed;
      border-radius: 2px;
      background: rgb(134 139 148 / 28%);
    }
  `,
};

export default CommuteLegend;
