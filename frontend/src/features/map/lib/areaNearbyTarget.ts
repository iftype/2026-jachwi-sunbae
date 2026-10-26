export type AreaNearbyTarget = { name: string; latitude: number; longitude: number };
export type AreaNearbyBase = '/explore' | '/neighborhoods';

const DEFAULT_BACK_PATH = '/explore';
const DEFAULT_AREA_NAME = '선택한 동네';
const isLocalPath = (value: string | null): value is string =>
  value !== null && value.startsWith('/') && !value.startsWith('//');

/** 동네 주변 분석 주소. 탐색 결과로 돌아갈 경로를 함께 넘긴다. */
export const areaNearbyPath = (base: AreaNearbyBase, target: AreaNearbyTarget, backTo: string) =>
  `${base}/nearby?${new URLSearchParams({
    latitude: String(target.latitude),
    longitude: String(target.longitude),
    name: target.name,
    backTo,
  })}`;

/** 주소 쿼리의 동네 좌표. 좌표가 없거나 범위를 벗어나면 null. */
export const readAreaNearbyTarget = (params: URLSearchParams): AreaNearbyTarget | null => {
  const latitude = Number(params.get('latitude'));
  const longitude = Number(params.get('longitude'));
  if (
    !params.has('latitude') ||
    !params.has('longitude') ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    return null;
  return { name: params.get('name')?.trim() || DEFAULT_AREA_NAME, latitude, longitude };
};

/** 돌아갈 경로는 같은 서비스 안의 주소만 허용한다. */
export const readAreaNearbyBackPath = (params: URLSearchParams) => {
  const backTo = params.get('backTo');
  return isLocalPath(backTo) ? backTo : DEFAULT_BACK_PATH;
};
