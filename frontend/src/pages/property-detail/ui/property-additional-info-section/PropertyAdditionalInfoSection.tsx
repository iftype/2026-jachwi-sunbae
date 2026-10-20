import { formatManwon } from '@/features/property/lib/propertyFormat';
import type { PropertyDetail } from '@/features/property/model/Property';
import { roomOptionLabels, utilityOptionLabels } from '@/features/property/model/propertyOptions';
import Icon from '@/shared/ui/icon/Icon';
import InfoValue from '@/shared/ui/info-value/InfoValue';

import PropertyInfoSection from '../property-info-section/PropertyInfoSection';

import detailStyles from '@/shared/ui/detail-section/DetailSection.module.css';

type PropertyAdditionalInfoSectionProps = {
  property: PropertyDetail;
  /** 상세 화면 위에 수정 시트를 연다. */
  onEdit: () => void;
};

const formatDate = (value: string | null): string => value?.replace(/-/g, '.') ?? '';
// LocalDateTime은 초가 0이면 초 자리를 생략해서 온다. 초가 붙어 온 경우에만 잘라낸다.
const formatDateTime = (value: string | null): string =>
  value === null ? '' : value.replace('T', ' ').replace(/(\d{2}:\d{2}):\d{2}(?:\.\d+)?$/, '$1');

/** 새 매물 API가 돌려준 부가 정보를 그대로 표시하고, 편집은 상세 위 시트에서 전체 PUT으로 저장한다. */
const PropertyAdditionalInfoSection = ({ property, onEdit }: PropertyAdditionalInfoSectionProps) => (
  <PropertyInfoSection
    title="부가 정보"
    label="매물 부가 정보"
    action={
      <button className={detailStyles.sectionAction} type="button" aria-label="부가 정보 편집" onClick={onEdit}>
        <Icon name="edit" size={14} /> 편집
      </button>
    }
  >
    <InfoValue label="입주 가능일" value={formatDate(property.availableMoveInDate)} />
    <InfoValue
      label="관리비"
      value={property.maintenanceFeeAmount === null ? '' : formatManwon(property.maintenanceFeeAmount)}
    />
    <InfoValue label="관리비 포함 공과금" value={utilityOptionLabels(property.utilityOptions)} />
    <InfoValue label="방 옵션" value={roomOptionLabels(property.roomOptions)} />
    <InfoValue label="방문 일정" value={formatDateTime(property.visitScheduledAt)} />
    <InfoValue label="확인한 곳" value={property.discoverySource.value} />
  </PropertyInfoSection>
);

export default PropertyAdditionalInfoSection;
