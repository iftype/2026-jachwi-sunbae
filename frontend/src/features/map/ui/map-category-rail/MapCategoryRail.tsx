import { css } from '@emotion/css';

import { MAP_CATEGORY_OPTIONS } from '../../lib/mapPresentation';
import type { MapCategory } from '../../model/Map';
import type { MapRailExtraItem } from '../../model/MapCanvas';
import MapCategoryIcon from '../map-category-icon/MapCategoryIcon';

type MapCategoryRailProps = {
  selectedCategories: MapCategory[];
  counts?: Partial<Record<MapCategory, number>>;
  onToggle: (category: MapCategory) => void;
  /** 거리 메모 탭을 함께 보여준다. 매물 주변 분석처럼 시설만 다루는 화면은 끈다. */
  showMemo?: boolean;
  /** 끄면 아이콘 없이 짧은 글자만 둔다. 본 방 기록 지도는 기록 마커와 헷갈리지 않게 끈다. */
  showIcons?: boolean;
  /** 이 화면에서 빼는 카테고리. 본 방 기록 지도는 동네 찾기에서 따로 보는 `중개`를 뺀다. */
  hiddenCategories?: MapCategory[];
  /** 시설 분류 아래에 이어 붙일 칸(동네 찾기의 `My` 등). 모양은 시설 칸과 같다. */
  extraItems?: MapRailExtraItem[];
  className?: string;
};

/** 지도 오른쪽에 세로로 쌓는 카테고리 버튼. 마커와 같은 아이콘 아래에 짧은 글자를 작게 둔다. */
const MapCategoryRail = ({
  selectedCategories,
  counts,
  onToggle,
  showMemo = false,
  showIcons = true,
  hiddenCategories = [],
  extraItems = [],
  className,
}: MapCategoryRailProps) => (
  <aside
    className={`${styles.rail} ${className ?? ''}`}
    aria-label="지도 시설 카테고리"
    data-icons={showIcons || undefined}
  >
    {MAP_CATEGORY_OPTIONS.filter(
      (option) => (showMemo || option.value !== 'MEMO') && !hiddenCategories.includes(option.value),
    ).map((option) => {
      const selected = selectedCategories.includes(option.value);
      const count = counts?.[option.value];
      return (
        <button
          key={option.value}
          type="button"
          className={styles.categoryButton}
          data-category={option.value}
          aria-pressed={selected}
          aria-label={`${option.label} ${selected ? '숨기기' : '표시하기'}${count === undefined ? '' : `, ${count}개`}`}
          onClick={() => onToggle(option.value)}
        >
          {showIcons && <MapCategoryIcon category={option.value} className={styles.icon} />}
          {option.shortLabel}
        </button>
      );
    })}
    {extraItems.map((item) => (
      <button
        key={item.key}
        type="button"
        className={styles.categoryButton}
        data-category={item.key}
        data-muted={item.isMuted || undefined}
        aria-pressed={item.selected}
        aria-label={item.ariaLabel}
        onClick={item.onToggle}
      >
        {item.icon === 'heart' && (
          <svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 24 24">
            <path
              d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
              fill={item.selected ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className={styles.extraLabel}>{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <b className={styles.badge} aria-hidden="true">
            {item.badge}
          </b>
        )}
      </button>
    ))}
  </aside>
);

const styles = {
  rail: css`
    label: MapCategoryRail-rail;
    position: absolute;
    z-index: 12;
    top: 1rem;
    right: 0.72rem;
    display: grid;
    overflow: hidden;
    border-radius: 0.6rem;
    background: var(--color-surface, #fff);
    box-shadow: 0 0.2rem 0.8rem rgb(42 48 35 / 16%);
  `,

  /* 찜한 동네 같은 이어 붙인 칸의 글자(다른 칸보다 한 줄에 4글자가 들어가게 조금 작게). */
  extraLabel: css`
    label: MapCategoryRail-extraLabel;
    font-size: 0.55rem;
    letter-spacing: -0.04em;
    white-space: nowrap;
  `,
  badge: css`
    label: MapCategoryRail-badge;
    position: absolute;
    top: 0.1rem;
    right: 0.15rem;
    min-width: 0.9rem;
    height: 0.9rem;
    padding: 0 0.2rem;
    border-radius: 999px;
    background: var(--color-brand-blue-ink, #3f6fc4);
    color: #fff;
    font-size: 0.55rem;
    line-height: 0.9rem;
    text-align: center;
  `,
  categoryButton: css`
    label: MapCategoryRail-categoryButton;
    display: grid;
    width: 2.6rem;
    height: 2.5rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: #25282d;
    font-size: 0.8rem;
    font-weight: 600;
    position: relative;
    cursor: pointer;
    align-content: center;
    justify-items: center;
    gap: 0.12rem;

    /* 아이콘이 없으면 기록 지도의 현재 위치 버튼이 레일 바로 아래(20.1rem)에 오도록 원래 높이 2.5rem을 지킨다. */
    [data-icons] > & {
      height: 3.1rem;
      font-size: 0.62rem;
    }

    &[data-muted='true'] {
      color: #b4b7bd;
    }

    & + & {
      border-top: 1px solid #ececec;
    }

    /* 켜진 카테고리는 추가 버튼과 같은 파란색으로 칠한다. */
    &[aria-pressed='true'] {
      background: #648fff;
      color: #fff;
    }

    &:focus-visible {
      outline: 2px solid #25282d;
      outline-offset: -2px;
    }
  `,

  icon: css`
    label: MapCategoryRail-icon;
    font-size: 1.45rem;
  `,
};

export default MapCategoryRail;
