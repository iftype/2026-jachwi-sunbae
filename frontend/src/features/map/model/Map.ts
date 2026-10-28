/** MEMO는 시설이 아니라 회원들이 남긴 거리 메모다. 주변 시설 조회에는 쓰지 않고 지도 화면 범위로 따로 조회한다. */
export type MapCategory = 'HOSPITAL' | 'TRANSPORT' | 'SCHOOL' | 'CONVENIENCE' | 'AGENCY' | 'MEMO';
export type NearbyCategory = Exclude<MapCategory, 'TRANSPORT' | 'MEMO'>;

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
  /** destination은 고른 장소를 이름이 든 말풍선 핀으로 그린다. 꼬리 끝이 좌표를 가리킨다. */
  /** flash는 destination과 같은 말풍선을 잠깐 띄웠다가 위로 떠오르며 사라진다(방금 남긴 메모 등). */
  tone?: 'property' | 'current' | 'place' | 'selected' | 'destination' | 'flash' | 'cluster' | 'propertyCluster';
  category?: MapCategory;
  /** 같은 카테고리 안에서 색으로 나눌 때 쓴다. 거리 메모의 좋아요(positive)·싫어요(negative). */
  variant?: 'positive' | 'negative';
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

/** 공인중개사. 전화번호와 카카오맵 상세 페이지는 공급자에 정보가 없으면 null이다. */
export type NearbyAgency = {
  providerPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  phone: string | null;
  placeUrl: string | null;
};

export type NearbyAgenciesResult = {
  center: { latitude: number; longitude: number };
  radius: 500 | 1000 | 2000;
  count: number;
  agencies: NearbyAgency[];
};
