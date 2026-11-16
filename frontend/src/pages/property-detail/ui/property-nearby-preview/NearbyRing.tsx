import { css } from '@emotion/css';
import type { CSSProperties } from 'react';

import { getMapCategoryLabel } from '@/features/map/lib/mapPresentation';
import type { NearbyCategorySummary } from '@/features/map/lib/nearbySummary';
import type { MapCategory } from '@/features/map/model/Map';

import { NEARBY_CATEGORY_COLOR } from './nearbyColors';

type NearbyRingProps = {
  summary: NearbyCategorySummary[];
  focused: MapCategory | null;
  onFocus: (category: MapCategory) => void;
};

const SIZE = 76;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** 조각 사이를 띄우는 길이. 체크리스트 진행 고리와 같다. */
const GAP = 5;

/**
 * 체크리스트 진행 고리와 같은 모양. 왼쪽 고리는 시설 수 비율과 가운데 합계, 오른쪽은 시설마다 한 줄씩
 * 지도와 같은 색 점, 이름, 개수, 가장 가까운 거리. 줄을 누르면 그 시설만 지도에 남는다.
 */
const NearbyRing = ({ summary, focused, onFocus }: NearbyRingProps) => {
  const filled = summary.filter((item) => item.count > 0);
  const total = filled.reduce((sum, item) => sum + item.count, 0);
  let start = 0;
  const segments = filled.map((item) => {
    const length = (CIRCUMFERENCE * item.count) / total;
    const segment = { item, offset: start, length };
    start += length;
    return segment;
  });

  return (
    <div className={styles.summary}>
      <span className={styles.ringWrap}>
        <svg className={styles.ring} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {segments.map(({ item, offset, length }) => (
            <circle
              key={item.category}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              stroke={NEARBY_CATEGORY_COLOR[item.category]}
              {...(segments.length > 1 && {
                strokeLinecap: 'round' as const,
                strokeDasharray: `${Math.max(length - GAP - STROKE, 0.01)} ${CIRCUMFERENCE}`,
                strokeDashoffset: -(offset + (GAP + STROKE) / 2),
              })}
            />
          ))}
        </svg>
        <strong className={styles.total} aria-label={`500m 안 시설 ${total}곳`}>
          {total}
        </strong>
      </span>
      <ul className={styles.legend} aria-label="500m 안 시설 수">
        {summary.map((item) => (
          <li
            key={item.category}
            data-dimmed={(focused !== null && focused !== item.category) || undefined}
            data-empty={item.count === 0 || undefined}
            style={{ '--dot': NEARBY_CATEGORY_COLOR[item.category] } as CSSProperties}
          >
            <button
              type="button"
              aria-pressed={focused === item.category}
              disabled={item.count === 0}
              onClick={() => onFocus(item.category)}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.label}>{getMapCategoryLabel(item.category)}</span>
              <strong>
                {item.count}
                {item.capped ? '+' : ''}
              </strong>
              {item.nearestMeters !== null && <small>{item.nearestMeters}m</small>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const styles = {
  /* 고리와 범례가 가로를 반씩 쓴다. */
  summary: css`
    label: NearbyRing-summary;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
  `,

  ringWrap: css`
    label: NearbyRing-ringWrap;
    position: relative;
    display: grid;
    justify-self: center;
    place-items: center;
  `,

  ring: css`
    label: NearbyRing-ring;
    /* 12시 방향에서 시작하도록 돌린다. */
    transform: rotate(-90deg);

    & circle {
      fill: none;
    }
  `,

  total: css`
    label: NearbyRing-total;
    position: absolute;
    color: var(--color-ink);
    font-size: 1.1rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  `,

  legend: css`
    label: NearbyRing-legend;
    display: grid;
    justify-self: start;
    margin: 0;
    padding: 0;
    list-style: none;

    & button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 1.4rem;
      padding: 0 0.25rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: inherit;
      font: inherit;
      line-height: 1.2;
      cursor: pointer;
    }

    & button:disabled {
      cursor: default;
    }

    & button[aria-pressed='true'] {
      background: var(--color-surface-muted);
    }

    & li[data-dimmed='true'],
    & li[data-empty='true'] {
      opacity: 0.4;
    }

    & strong {
      min-width: 1.75rem;
      color: var(--dot);
      font-size: 0.86rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    & small {
      color: var(--color-muted, #6b7280);
      font-size: 0.72rem;
    }
  `,

  /* 지도에 찍히는 점과 같은 모양. */
  dot: css`
    label: NearbyRing-dot;
    width: 0.6rem;
    height: 0.6rem;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--dot);
  `,

  label: css`
    label: NearbyRing-label;
    min-width: 3.25rem;
    color: var(--color-ink-soft);
    font-size: 0.78rem;
    font-weight: 650;
  `,
};

export default NearbyRing;
