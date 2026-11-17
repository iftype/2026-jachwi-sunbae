import type { PropertyCommuteTime } from '@/features/property/model/Property';

/** 레일 `My`를 켰을 때 지도와 시트(카드)에 보이는 매물 한 줄. 매물 목록 응답과 통근 시간 응답을 합친다. */
export type MyPropertyRow = {
  propertyId: number;
  name: string;
  depositAmount: number;
  monthlyRentAmount: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  commute: PropertyCommuteTime | null;
  representativePhoto: { photoId: number; contentUrl: string; thumbnailUrl: string } | null;
};
