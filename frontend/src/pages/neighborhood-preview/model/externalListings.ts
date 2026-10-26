export type ListingCoordinate = { latitude: number; longitude: number };
export type ListingViewport = 'desktop' | 'mobile';

/**
 * 다방 웹 지도의 비공식 주소다. 다방 코드가 같은 형식으로 링크를 만들지만 문서화된 딥링크는 없다.
 * 모바일은 다방 서버의 자동 이동이 `m_zoom` 끝에 `}`를 붙여 줌이 무시되므로 모바일 주소로 바로 연다.
 */
const DABANG_ONETWO_MAP_URL: Record<ListingViewport, string> = {
  desktop: 'https://www.dabangapp.com/map/onetwo',
  mobile: 'https://www.dabangapp.com/mobile/map/onetwo',
};
/** 동네 하나가 화면에 들어오는 줌이다. 다방은 매물 하나를 열 때 16을 쓴다. */
const DABANG_NEIGHBORHOOD_ZOOM = 15;

/** 동네 중심 좌표로 다방 원·투룸 지도를 여는 주소. 좌표가 없으면 지도 기본 화면으로 연다. */
export const dabangListingUrl = ({ latitude, longitude }: ListingCoordinate, viewport: ListingViewport = 'desktop') => {
  const base = DABANG_ONETWO_MAP_URL[viewport];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return base;
  const url = new URL(base);
  url.searchParams.set('m_lat', latitude.toString());
  url.searchParams.set('m_lng', longitude.toString());
  url.searchParams.set('m_zoom', DABANG_NEIGHBORHOOD_ZOOM.toString());
  return url.toString();
};
