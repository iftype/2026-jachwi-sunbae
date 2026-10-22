import { formatManwon } from '@/features/property/lib/propertyFormat';
import type { PropertyDetail } from '@/features/property/model/Property';
import Icon from '@/shared/ui/icon/Icon';
import InfoValue from '@/shared/ui/info-value/InfoValue';

import PropertyInfoSection from '../property-info-section/PropertyInfoSection';

import detailStyles from '@/shared/ui/detail-section/DetailSection.module.css';

type PropertyBasicInfoSectionProps = {
  property: PropertyDetail;
  /** 상세 화면 위에 수정 시트를 연다. */
  onEdit: () => void;
};

const PropertyBasicInfoSection = ({ property, onEdit }: PropertyBasicInfoSectionProps) => (
  <PropertyInfoSection
    title="기본 정보"
    label="매물 기본 정보"
    action={
      <button className={detailStyles.sectionAction} type="button" aria-label="기본 정보 편집" onClick={onEdit}>
        <Icon name="edit" size={14} /> 편집
      </button>
    }
  >
    <InfoValue label="매물 이름" value={property.name} />
    <InfoValue
      label="보증금 / 월세"
      value={`${formatManwon(property.depositAmount)} / ${formatManwon(property.monthlyRentAmount)}`}
    />
    <InfoValue label="주소" value={property.location.address ?? ''} emptyText="주소를 입력해 주세요" />
  </PropertyInfoSection>
);

export default PropertyBasicInfoSection;
