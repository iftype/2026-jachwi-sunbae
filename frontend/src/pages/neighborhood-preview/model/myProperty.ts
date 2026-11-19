import type { PropertyCommuteTime, PropertySummary } from '@/features/property/model/Property';

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
  /** 내 기록 목록과 같은 매물 카드를 그릴 요약. */
  summary: PropertySummary;
  representativePhoto: { photoId: number; contentUrl: string; thumbnailUrl: string } | null;
  /** 첫 방을 기록하기 전에 보여 주는 미리보기 매물인지. 서버에 없는 매물이라 통근 시간과 동선을 부르지 않는다. */
  isPreview?: boolean;
};
