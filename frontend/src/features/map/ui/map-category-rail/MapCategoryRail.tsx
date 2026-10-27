import { MAP_CATEGORY_OPTIONS } from '../../lib/mapPresentation';
import type { MapCategory } from '../../model/Map';
import MapCategoryIcon from '../map-category-icon/MapCategoryIcon';

import styles from './MapCategoryRail.module.css';

type MapCategoryRailProps = {
  selectedCategories: MapCategory[];
  counts?: Partial<Record<MapCategory, number>>;
  onToggle: (category: MapCategory) => void;
  /** 거리 메모 탭을 함께 보여준다. 매물 주변 분석처럼 시설만 다루는 화면은 끈다. */
  showMemo?: boolean;
  className?: string;
};

const MapCategoryRail = ({
  selectedCategories,
  counts,
  onToggle,
  showMemo = false,
  className,
}: MapCategoryRailProps) => (
  <aside className={`${styles.rail} ${className ?? ''}`} aria-label="지도 시설 카테고리">
    {MAP_CATEGORY_OPTIONS.filter((option) => showMemo || option.value !== 'MEMO').map((option) => {
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
          <MapCategoryIcon category={option.value} className={styles.icon} />
          <span>{option.shortLabel}</span>
        </button>
      );
    })}
  </aside>
);

export default MapCategoryRail;
