import { formatMarkerRent, formatPropertyPrice } from '@/features/property/lib/propertyFormat';
import type { PropertySummary } from '@/features/property/model/Property';

export const propertyArea = (address: string | null) => {
  const parts = address?.split(/\s+/) ?? [];
  return (
    parts.find((part) => /(?:동|읍|면)$/.test(part)) ??
    parts.find((part) => /(?:구|군)$/.test(part)) ??
    parts.find((part) => /시$/.test(part)) ??
    '주소 미등록'
  );
};

export const recordPresentation = (property: PropertySummary) => ({
  /** 공용 매물 카드(PropertyCard)에 그대로 넘기는 원본 요약. */
  summary: property,
  id: String(property.propertyId),
  district: propertyArea(property.location.address),
  name: property.name,
  note: property.location.address ?? '주소 미등록',
  /** 지도 마커에 붙는 짧은 가격. 가격을 넣기 전에도 `월세 0/0`으로 표시한다. */
  price: formatPropertyPrice(property.depositAmount, property.monthlyRentAmount, 'summary'),
  rent: formatMarkerRent(property.monthlyRentAmount),
  latitude: property.location.latitude,
  longitude: property.location.longitude,
  checklist: property.stages.find((stage) => stage.stage === 'ON_SITE') ?? null,
  representativePhoto: property.representativePhoto,
});

type AddressedRecord = { latitude: number | null; longitude: number | null; note: string; summary: PropertySummary };

/** 주소가 없거나 위치가 없는 기록인지(`주소 미등록`). */
export const isAddressUnregistered = (record: Pick<AddressedRecord, 'latitude' | 'longitude' | 'summary'>): boolean =>
  !record.summary.location.address || record.latitude === null || record.longitude === null;

/**
 * 주소 미등록 기록을 맨 뒤로 보낸다. 주소가 있는 기록의 순서와 미등록 기록끼리의 순서는 그대로 둔다(안정 정렬).
 * 데스크탑과 모바일 리스트, 지도 마커 목록, 이전과 다음 이동이 모두 이 순서를 쓰도록 목록을 만드는 한 곳에서 부른다.
 */
export const moveUnregisteredLast = <T extends Pick<AddressedRecord, 'latitude' | 'longitude' | 'summary'>>(
  records: T[],
): T[] => [...records.filter((record) => !isAddressUnregistered(record)), ...records.filter(isAddressUnregistered)];
