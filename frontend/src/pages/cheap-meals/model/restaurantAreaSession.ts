import { isInSouthKorea } from '@/features/map/lib/mapLocation';

import type { RestaurantArea } from './RestaurantMap';

/**
 * 식당 탭에서 고른 동네. 새로고침해도 주소의 가게(`?store=`)와 동네가 어긋나지 않게 탭(세션)에만 둔다.
 * 주소에 좌표를 넣으면 화면 경로 기록(`$pageview`)에 위치가 남고 지도를 옮길 때마다 기록이 쌓여 주소에는 두지 않는다.
 */
const RESTAURANT_AREA_KEY = 'jachwi-sunbae.cheapMeals.restaurantArea';
const RESTAURANT_LIST_KEY = 'jachwi-sunbae.cheapMeals.restaurantList';
const MAX_LABEL_LENGTH = 200;

const isRestaurantArea = (value: unknown): value is RestaurantArea => {
  if (typeof value !== 'object' || value === null) return false;
  const { latitude, longitude, label } = value as Record<string, unknown>;
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    typeof label === 'string' &&
    label.trim().length > 0 &&
    label.length <= MAX_LABEL_LENGTH &&
    isInSouthKorea({ latitude, longitude })
  );
};

export const readRestaurantArea = (storage: Storage = window.sessionStorage): RestaurantArea | null => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(RESTAURANT_AREA_KEY) ?? 'null');
    if (!isRestaurantArea(parsed)) return null;
    return { latitude: parsed.latitude, longitude: parsed.longitude, label: parsed.label };
  } catch {
    return null;
  }
};

export const writeRestaurantArea = (area: RestaurantArea, storage: Storage = window.sessionStorage): void => {
  try {
    storage.setItem(
      RESTAURANT_AREA_KEY,
      JSON.stringify({ latitude: area.latitude, longitude: area.longitude, label: area.label }),
    );
  } catch {
    // 브라우저 저장소를 쓸 수 없으면 새로고침할 때 기본 동네로 돌아갈 뿐 목록은 그대로 쓴다.
  }
};

/** 가게 목록을 직접 닫으면 같은 탭에서 화면을 다시 열어도 닫힌 상태로 둔다. */
export const readRestaurantListOpen = (): boolean => {
  try {
    return window.sessionStorage.getItem(RESTAURANT_LIST_KEY) !== 'closed';
  } catch {
    return true;
  }
};

export const writeRestaurantListOpen = (isOpen: boolean): void => {
  try {
    if (isOpen) window.sessionStorage.removeItem(RESTAURANT_LIST_KEY);
    else window.sessionStorage.setItem(RESTAURANT_LIST_KEY, 'closed');
  } catch {
    // 저장소를 사용할 수 없는 경우에는 현재 화면에서만 상태를 기억한다.
  }
};
