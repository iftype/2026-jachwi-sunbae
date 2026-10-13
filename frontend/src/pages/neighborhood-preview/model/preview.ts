import type { MapRegion } from '@/features/map/model/MapCanvas';

export const PREVIEW_DESTINATION = {
  name: '우테코 판교사옥',
  address: '판교역 인근 · 시안용 목적지',
  latitude: 37.395,
  longitude: 127.111,
};

/** 향후 서버와 협의할 가정 DTO. GeoJSON 좌표 순서는 [경도, 위도]. */
export type DistrictPresetResponse = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { id: string; name: string; administrativeDongCode: string | null };
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  }[];
};

// 실제 행정동 경계가 아니다. 이름과 도형을 연결하는 인터랙션 확인용 가상 경계.
export const DISTRICT_PRESET_FIXTURE: DistrictPresetResponse = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'sample-sampyeong', name: '삼평동', administrativeDongCode: null },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [127.1, 37.401],
            [127.112, 37.4],
            [127.123, 37.405],
            [127.123, 37.418],
            [127.108, 37.419],
            [127.1, 37.412],
            [127.1, 37.401],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'sample-baekhyeon', name: '백현동', administrativeDongCode: null },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [127.1, 37.401],
            [127.112, 37.4],
            [127.123, 37.405],
            [127.131, 37.399],
            [127.126, 37.383],
            [127.109, 37.382],
            [127.1, 37.39],
            [127.1, 37.401],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'sample-pangyo', name: '판교동', administrativeDongCode: null },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [127.1, 37.401],
            [127.1, 37.39],
            [127.084, 37.386],
            [127.075, 37.398],
            [127.078, 37.412],
            [127.089, 37.418],
            [127.1, 37.412],
            [127.1, 37.401],
          ],
        ],
      },
    },
  ],
};

// 주변 행정동 전체 응답을 가정해 후보를 더한다. 경계·코드는 실제 자료가 아니다.
DISTRICT_PRESET_FIXTURE.features.push(
  {
    type: 'Feature',
    properties: { id: 'sample-imae', name: '이매1동', administrativeDongCode: null },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [127.123, 37.405],
          [127.131, 37.399],
          [127.143, 37.399],
          [127.147, 37.415],
          [127.134, 37.422],
          [127.123, 37.418],
          [127.123, 37.405],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    properties: { id: 'sample-yatap', name: '야탑1동', administrativeDongCode: null },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [127.123, 37.418],
          [127.134, 37.422],
          [127.147, 37.415],
          [127.155, 37.428],
          [127.141, 37.44],
          [127.122, 37.435],
          [127.123, 37.418],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    properties: { id: 'sample-seohyeon', name: '서현1동', administrativeDongCode: null },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [127.131, 37.399],
          [127.126, 37.383],
          [127.14, 37.377],
          [127.155, 37.388],
          [127.143, 37.399],
          [127.131, 37.399],
        ],
      ],
    },
  },
);

export type RecommendationPriority = 'balanced' | 'transport' | 'rent';
export type DistrictEvidence = {
  id: string;
  transit: { minutes: number; transfers: number; representativeStop: string } | null;
  rental: {
    legalDongName: string;
    depositManwon: number;
    medianMonthlyRentManwon: number;
    transactionCount: number;
    period: string;
    areaRange: string;
  } | null;
};

export type RentalTransactionSample = {
  contractMonth: string;
  depositManwon: number;
  monthlyRentManwon: number;
  areaSquareMeters: number;
};
/** 상세 확인용 가상 거래 3건. 위 집계 표본 전체를 재현한 것은 아니다. */
export const rentalTransactionSamples = (
  rental: NonNullable<DistrictEvidence['rental']>,
): RentalTransactionSample[] => [
  {
    contractMonth: '2026.09',
    depositManwon: rental.depositManwon,
    monthlyRentManwon: rental.medianMonthlyRentManwon + 5,
    areaSquareMeters: 30,
  },
  {
    contractMonth: '2026.08',
    depositManwon: rental.depositManwon,
    monthlyRentManwon: rental.medianMonthlyRentManwon,
    areaSquareMeters: 26,
  },
  {
    contractMonth: '2026.07',
    depositManwon: rental.depositManwon,
    monthlyRentManwon: rental.medianMonthlyRentManwon - 5,
    areaSquareMeters: 23,
  },
];

/** 별도 교통·실거래 응답을 구역 ID로 조합한다고 가정한 샘플. */
export const DISTRICT_EVIDENCE_FIXTURE: DistrictEvidence[] = [
  {
    id: 'sample-sampyeong',
    transit: { minutes: 18, transfers: 0, representativeStop: '삼평동 대표 정류장' },
    rental: {
      legalDongName: '삼평동',
      depositManwon: 1000,
      medianMonthlyRentManwon: 75,
      transactionCount: 24,
      period: '최근 6개월',
      areaRange: '20~33㎡',
    },
  },
  {
    id: 'sample-baekhyeon',
    transit: { minutes: 23, transfers: 0, representativeStop: '백현동 대표 정류장' },
    rental: {
      legalDongName: '백현동',
      depositManwon: 1000,
      medianMonthlyRentManwon: 65,
      transactionCount: 18,
      period: '최근 6개월',
      areaRange: '20~33㎡',
    },
  },
  {
    id: 'sample-pangyo',
    transit: { minutes: 28, transfers: 0, representativeStop: '판교동 대표 정류장' },
    rental: {
      legalDongName: '판교동',
      depositManwon: 1000,
      medianMonthlyRentManwon: 55,
      transactionCount: 16,
      period: '최근 6개월',
      areaRange: '20~33㎡',
    },
  },
  {
    id: 'sample-imae',
    transit: { minutes: 38, transfers: 1, representativeStop: '이매역' },
    rental: {
      legalDongName: '이매동',
      depositManwon: 1000,
      medianMonthlyRentManwon: 50,
      transactionCount: 12,
      period: '최근 6개월',
      areaRange: '20~33㎡',
    },
  },
  {
    id: 'sample-yatap',
    transit: { minutes: 48, transfers: 1, representativeStop: '야탑역' },
    rental: {
      legalDongName: '야탑동',
      depositManwon: 1000,
      medianMonthlyRentManwon: 45,
      transactionCount: 10,
      period: '최근 6개월',
      areaRange: '20~33㎡',
    },
  },
  { id: 'sample-seohyeon', transit: null, rental: null },
];

// 임시 선정 규칙: 교통과 거래 표본이 있는 후보만, 선택 기준 점수로 최대 3곳.
// 점수 가중치/컷오프는 제품 정책이 아니라 시안 확인용이다.
export const recommendDistricts = (evidence: DistrictEvidence[], priority: RecommendationPriority) =>
  evidence
    .filter(
      (item) =>
        item.transit !== null &&
        item.transit.minutes <= 60 &&
        item.rental !== null &&
        item.rental.transactionCount >= 5,
    )
    .map((item) => {
      const transportCost = item.transit!.minutes + item.transit!.transfers * 10;
      const rentCost = item.rental!.medianMonthlyRentManwon;
      const score =
        priority === 'transport' ? transportCost : priority === 'rent' ? rentCost : transportCost + rentCost * 0.5;
      return { ...item, score };
    })
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, 3);

export const toMapRegions = (response: DistrictPresetResponse): MapRegion[] =>
  response.features.map((feature) => ({
    id: feature.properties.id,
    name: feature.properties.name,
    paths: feature.geometry.coordinates.map((ring) => ring.map(([longitude, latitude]) => ({ latitude, longitude }))),
  }));
export const PREVIEW_REGIONS = toMapRegions(DISTRICT_PRESET_FIXTURE);
