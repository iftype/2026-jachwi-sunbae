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
  /** rank는 순위 숫자와 이름을 붙인 알약으로 그린다(동네 찾기 상위 동네 등). 가운데가 좌표에 온다. */
  tone?:
    | 'property'
    | 'current'
    | 'place'
    | 'selected'
    | 'destination'
    | 'pinLabel'
    | 'flash'
    | 'cluster'
    | 'propertyCluster'
    | 'rank'
    | 'dot';
  /** tone이 pinLabel일 때 점 모양. search는 파란 점, map(지도를 눌러 고른 곳)은 파란 링이다. */
  pinKind?: 'search' | 'commute';
  /** tone이 pinLabel이고 search일 때 라벨에 `출퇴근 장소로 설정` 작은 버튼을 둔다. 누르면 `<id>:set-commute`로 알린다. */
  setsCommute?: boolean;
  /** tone이 pinLabel일 때 라벨 오른쪽 끝에 작은 ×를 둔다. 마커를 누르면 지운다(`actionable`과 함께 쓴다). */
  removable?: boolean;
  /** tone이 dot일 때 점 색. 매물 주변 미리보기처럼 시설을 작은 색 점으로만 보일 때 쓴다. */
  color?: string;
  category?: MapCategory;
  /** 주면 이 그림을 아래 가운데가 좌표를 가리키는 핀으로 그린다. 매물 등록, 메모를 남기려고 찍은 자리처럼 기호가 정해진 마커에 쓴다. */
  image?: { src: string; src2x?: string };
  /** 주면 매물 핀의 집 그림 대신 이 사진을 모서리 둥근 네모로 잘라 올린다. 대표 사진이 있는 매물에 쓴다. */
  photo?: string;
  /** 처음 그릴 때 아래에서 떠오르며 나타난다. 방금 남긴 메모처럼 새로 생긴 마커에 쓴다. */
  appear?: boolean;
  /**
   * 처음 그릴 때 작게 시작해 튀어나오듯 커진다. 지도에 새로 들어온 메모 말풍선에 쓴다.
   * delayMs만큼 늦게 시작해, 여러 마커가 한꺼번에 나타날 때 차례로 튀어나온다.
   */
  pop?: { delayMs: number };
  /**
   * 같은 카테고리 안에서 그림을 나눌 때 쓴다. 거리 메모의 좋아요(positive)·싫어요(negative),
   * 교통의 지하철역(subway). 교통에 값이 없으면 버스 정류장으로 그린다.
   */
  variant?: 'positive' | 'negative' | 'subway';
  count?: number;
  /** tone이 rank일 때 알약 앞 동그라미에 쓰는 순위. */
  rank?: number;
  /** 겹친 거리 메모를 묶은 말풍선의 좋아요·싫어요 개수. 주면 글 대신 두 색으로 나눈 말풍선에 개수를 그린다. */
  tally?: { positive: number; negative: number };
  placeId?: string;
  actionable?: boolean;
  /** 매물 핀을 작게 그리고 다른 마커(가게 등) 아래에 둔다. 저렴한 한 끼 지도처럼 매물이 주인공이 아닌 화면에 쓴다. */
  compact?: boolean;
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
