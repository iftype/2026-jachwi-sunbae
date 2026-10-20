export type MapCategory = 'HOSPITAL' | 'TRANSPORT' | 'SCHOOL' | 'CONVENIENCE' | 'AGENCY';
export type NearbyCategory = Exclude<MapCategory, 'TRANSPORT'>;

export type MapBounds = { south: number; west: number; north: number; east: number };

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  /** 마커 아래에 노출할 짧은 문구. 없으면 label을 쓴다. */
  caption?: string;
  /** 매물 제목과 금액을 고정 카드로 표시할 때 사용한다. */
  summary?: { amount: string };
  tone?: 'property' | 'current' | 'place' | 'selected' | 'cluster' | 'propertyCluster';
  category?: MapCategory;
  count?: number;
  placeId?: string;
  actionable?: boolean;
};

export type MapAddress = {
  address: string | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  latitude: number;
  longitude: number;
};

export type NearbyPlace = {
  providerPlaceId: string;
  name: string;
  category: MapCategory;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

export type NearbyResult = {
  center: { latitude: number; longitude: number };
  radius: 500 | 1000 | 2000;
  counts: Record<NearbyCategory, number>;
  places: NearbyPlace[];
};
