import { getMapCategoryLabel } from '@/features/map/lib/mapPresentation';
import type { MapCategory } from '@/features/map/model/Map';

import { type MapRadius, radiusLabel } from '../../lib/mapRadius';

import styles from './MapNearbyCountToast.module.css';

type MapNearbyCountToastProps = {
  radius: MapRadius;
  category: MapCategory;
  count: number;
  isAddMode?: boolean;
};

const categorySubject = (category: MapCategory): string => {
  const label = getMapCategoryLabel(category);
  return `${label}${['학교'].includes(label) ? '가' : '이'}`;
};

const MapNearbyCountToast = ({ radius, category, count, isAddMode = false }: MapNearbyCountToastProps) => (
  <div className={styles.toast} data-add-mode={isAddMode} role="status" aria-live="polite">
    {radiusLabel(radius)} 근처에 {categorySubject(category)} {count}개 있습니다.
  </div>
);

export default MapNearbyCountToast;
