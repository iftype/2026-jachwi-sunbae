export type MapCategory = 'HOSPITAL' | 'TRANSPORT' | 'SCHOOL' | 'CONVENIENCE' | 'AGENCY';

export type MapBounds = { south: number; west: number; north: number; east: number };

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  /** 마커 아래에 노출할 짧은 문구. 없으면 label을 쓴다. */
  caption?: string;
  tone?: 'property' | 'current' | 'place' | 'selected' | 'cluster' | 'propertyCluster';
  category?: MapCategory;
  count?: number;
  placeId?: string;
  /** 마커 안에 넣을 매물 사진. 인증이 끝난 blob URL만 받는다. */
  photoUrl?: string;
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
  counts: Record<MapCategory, number>;
  places: NearbyPlace[];
};
