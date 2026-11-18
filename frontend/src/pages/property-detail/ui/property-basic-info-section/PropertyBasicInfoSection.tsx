import { type ReactNode, useState } from 'react';

import { UNSUPPORTED_ADDRESS_MESSAGE } from '@/features/map/lib/mapAddress';
import { DEFAULT_PROPERTY_NAME } from '@/features/property/lib/propertyForm';
import { formatPropertyPrice, hasPropertyPrice } from '@/features/property/lib/propertyFormat';
import type { PropertyDetail } from '@/features/property/model/Property';
import InfoValue from '@/shared/ui/info-value/InfoValue';

import type { BasicEditField, PropertyEditField } from '../../model/editField';
import PropertyInfoSection from '../property-info-section/PropertyInfoSection';
import PropertySavedNote from '../PropertySavedNote';
import PropertyNameInput from './PropertyNameInput';
import PropertyPriceInput from './PropertyPriceInput';

type PropertyBasicInfoSectionProps = {
  property: PropertyDetail;
  /** 지금 그 줄 안에서 고치고 있는 항목. 상세 화면 하나에서 한 번에 한 줄만 연다. */
  editingField: PropertyEditField | null;
  /** 누른 항목을 그 줄 안의 입력으로 연다. 이름은 이 섹션 안에서 따로 연다. */
  onEdit: (field: BasicEditField) => void;
  onSaved: (field: BasicEditField) => void;
  onCancel: () => void;
  /** 주소를 누르면 위치를 바꾸는 지도 화면으로 이동한다. 지도를 계속 눌러 자리를 바꿔 가며 정한다. */
  onEditLocation: () => void;
  /** 방금 저장한 항목. 그 줄 값 아래에 잠깐 저장했다고 알린다. */
  savedField: PropertyEditField | null;
  /** 주소 줄 바로 아래에 붙이는 내용. 매물 상세는 주변 지도와 시설 요약을 둔다. */
  afterAddress?: ReactNode;
};

/** 새 매물은 보증금과 월세를 0으로 만든다. 둘 다 0이면 비워 두어 입력을 권하는 안내(`emptyText`)를 보인다. */
const formatPrice = ({ depositAmount, monthlyRentAmount }: PropertyDetail): string =>
  hasPropertyPrice(depositAmount, monthlyRentAmount)
    ? formatPropertyPrice(depositAmount, monthlyRentAmount, 'plain')
    : '';

/** 위치만으로 바로 만든 뒤 아직 이름도 금액도 채우지 않은 매물인지. */
const isFreshProperty = ({ name, depositAmount, monthlyRentAmount }: PropertyDetail): boolean =>
  name === DEFAULT_PROPERTY_NAME && !hasPropertyPrice(depositAmount, monthlyRentAmount);

const SAVED_TEXT = '✓ 저장했어요';

/** 기본 정보. 줄을 누르면 모달 없이 그 줄 안에서 바로 고친다. 이름은 처음 등록했을 때만 바꾼다. */
const PropertyBasicInfoSection = ({
  property,
  editingField,
  onEdit,
  onSaved,
  onCancel,
  onEditLocation,
  savedField,
  afterAddress,
}: PropertyBasicInfoSectionProps) => {
  // 이름은 처음 등록해 `새 매물`로 남아 있을 때만 바꾼다. 방금 만든 매물(금액도 미입력)이면 이름 칸을 바로 열어 포커스를 둔다.
  const isUnnamed = property.name === DEFAULT_PROPERTY_NAME;
  const [isEditingName, setIsEditingName] = useState(() => isFreshProperty(property));
  return (
    <>
      <PropertyInfoSection
        title="기본 정보"
        label="매물 기본 정보"
        meta={savedField === 'price' || savedField === 'location' ? <PropertySavedNote text={SAVED_TEXT} /> : undefined}
      >
        <InfoValue
          label="매물 이름"
          value={property.name}
          onEdit={isUnnamed ? () => setIsEditingName(true) : undefined}
          editor={
            isEditingName ? <PropertyNameInput property={property} onDone={() => setIsEditingName(false)} /> : undefined
          }
        />
        <InfoValue
          label="보증금 / 월세"
          value={formatPrice(property)}
          emptyText="보증금과 월세를 입력해 주세요"
          onEdit={() => onEdit('price')}
          // 보증금과 월세는 값이 있던 자리에서 바로 고친다.
          editor={
            editingField === 'price' ? (
              <PropertyPriceInput property={property} onSaved={() => onSaved('price')} onCancel={onCancel} />
            ) : undefined
          }
        />
        <InfoValue
          label="주소"
          value={property.location.address ?? ''}
          emptyText={UNSUPPORTED_ADDRESS_MESSAGE}
          onEdit={onEditLocation}
        />
        {afterAddress !== undefined && <div>{afterAddress}</div>}
      </PropertyInfoSection>
    </>
  );
};

export default PropertyBasicInfoSection;
