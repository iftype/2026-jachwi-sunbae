import { Link } from 'react-router-dom';

import { ALL_MAP_CATEGORIES, getMapCategoryLabel } from '@/features/map/lib/mapPresentation';
import type { MapCategory, NearbyPlace } from '@/features/map/model/Map';
import Icon from '@/shared/ui/icon/Icon';

import styles from './MapNearbySheet.module.css';

type MapNearbySheetProps = {
  eyebrow?: string;
  heading: string;
  counts: Record<Exclude<MapCategory, 'MEMO'>, number>;
  selectedCategories: MapCategory[];
  places: NearbyPlace[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleCategory: (category: MapCategory) => void;
};

const MapNearbySheet = ({
  eyebrow,
  heading,
  counts,
  selectedCategories,
  places,
  expanded,
  onToggleExpanded,
  onToggleCategory,
}: MapNearbySheetProps) => (
  <section className={styles.sheet} data-expanded={expanded || undefined} aria-label={heading}>
    <span className={styles.dragHandle} aria-hidden="true" />
    <div className={styles.header}>
      <div>
        {eyebrow !== undefined && <span>{eyebrow}</span>}
        <h1>{heading}</h1>
      </div>
      <button type="button" aria-expanded={expanded} aria-controls="nearby-place-list" onClick={onToggleExpanded}>
        {expanded ? '목록 접기' : '시설 목록 보기'}
        <Icon name={expanded ? 'chevron-down' : 'chevron-up'} size={17} />
      </button>
    </div>

    <ul className={styles.summary} aria-label="주변 시설 집계와 필터">
      {ALL_MAP_CATEGORIES.map((category) => {
        const selected = selectedCategories.includes(category);
        const label = getMapCategoryLabel(category);
        return (
          <li key={category} data-category={category}>
            <button
              type="button"
              aria-pressed={selected}
              aria-label={`${label} ${counts[category]}개 ${selected ? '숨기기' : '표시하기'}`}
              onClick={() => onToggleCategory(category)}
            >
              <span aria-hidden="true" />
              {label} {counts[category]}개
            </button>
          </li>
        );
      })}
    </ul>

    {expanded && (
      <div
        className={styles.scrollArea}
        id="nearby-place-list"
        role="region"
        aria-label="스크롤 가능한 주변 시설 목록"
        tabIndex={0}
      >
        {selectedCategories.length === 0 ? (
          <p>위에서 확인할 시설을 선택해 주세요.</p>
        ) : places.length === 0 ? (
          <p>이 반경에는 선택한 시설이 없어요.</p>
        ) : (
          <ul aria-label="주변 시설 목록">
            {places.map((place) => (
              <li key={place.providerPlaceId}>
                <span data-category={place.category}>{getMapCategoryLabel(place.category)}</span>
                <strong>{place.name}</strong>
                <small>
                  {place.distanceMeters}m · {place.address}
                </small>
              </li>
            ))}
          </ul>
        )}
        <Link to="/me">지도 데이터 모드와 이용 안내</Link>
      </div>
    )}
  </section>
);

export default MapNearbySheet;
