import { useState } from 'react';

import { selectSingleCategory } from '@/features/map/lib/mapPresentation';
import type { MapCategory } from '@/features/map/model/Map';

import type { MapRadius } from '../lib/mapRadius';

const useMapFilters = (initial?: { categories: MapCategory[]; radius: MapRadius | null }) => {
  const [selectedCategories, setSelectedCategories] = useState<MapCategory[]>(initial?.categories ?? []);
  // 위치나 매물을 선택하기 전에는 반경을 표시하지 않는다.
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

  /** 꺼져 있으면 그 카테고리만 켠다. 이미 켜져 있으면 그대로 둔다. */
  const showCategory = (category: MapCategory) =>
    setSelectedCategories((current) => (current.includes(category) ? current : [category]));

  return { selectedCategories, selectedRadius, toggleCategory, showCategory, toggleRadius, ensureRadius };
};

export default useMapFilters;
