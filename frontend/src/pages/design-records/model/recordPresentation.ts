import { formatRentSummary } from '@/features/property/lib/propertyFormat';
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
  price:
    property.monthlyRentAmount > 0
      ? `월세 ${formatRentSummary(property.depositAmount, property.monthlyRentAmount)}`
      : formatRentSummary(property.depositAmount, property.monthlyRentAmount),
  latitude: property.location.latitude,
  longitude: property.location.longitude,
  checklist: property.stages.find((stage) => stage.stage === 'ON_SITE') ?? null,
  representativePhoto: property.representativePhoto,
});
