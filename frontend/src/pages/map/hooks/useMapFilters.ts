import { useState } from 'react';

import { selectSingleCategory } from '@/features/map/lib/mapPresentation';
import type { MapCategory } from '@/features/map/model/Map';

import type { MapRadius } from '../lib/mapRadius';

const useMapFilters = (initial?: { categories: MapCategory[]; radius: MapRadius | null }) => {
  const [selectedCategories, setSelectedCategories] = useState<MapCategory[]>(initial?.categories ?? []);
  // 반경은 사용자가 직접 선택했을 때만 표시한다. 초기 화면에 현재 위치 기준 원을 자동으로 띄우지 않는다.
  const [selectedRadius, setSelectedRadius] = useState<MapRadius | null>(initial?.radius ?? null);

  const toggleCategory = (category: MapCategory) =>
    setSelectedCategories((current) => selectSingleCategory(current, category));

  /** 같은 반경을 다시 누르면 해제한다. 새로 선택되었는지 돌려준다. */
  const toggleRadius = (radius: MapRadius): boolean => {
    const isSelecting = selectedRadius !== radius;
    setSelectedRadius(isSelecting ? radius : null);
    return isSelecting;
  };

  const ensureRadius = () => setSelectedRadius((current) => current ?? 500);

  return { selectedCategories, selectedRadius, toggleCategory, toggleRadius, ensureRadius };
};

export default useMapFilters;
