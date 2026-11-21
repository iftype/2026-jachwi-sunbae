import { type ReactNode, useEffect, useState } from 'react';

import { UNSUPPORTED_ADDRESS_MESSAGE } from '@/features/map/lib/mapAddress';
import type { MapAddress } from '@/features/map/model/Map';
import { forgetJustCreated, isJustCreated } from '@/features/property/lib/justCreatedProperties';
import { formatPropertyPrice, hasPropertyPrice } from '@/features/property/lib/propertyFormat';
import type { PropertyDetail } from '@/features/property/model/Property';
import InfoValue from '@/shared/ui/info-value/InfoValue';

import type { BasicEditField, PropertyEditField } from '../../model/editField';
import PropertyInfoSection from '../property-info-section/PropertyInfoSection';
import PropertySavedNote from '../PropertySavedNote';
import PropertyAddressSearchInput from './PropertyAddressSearchInput';
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
  /** 주소 검색 칸의 `지도에서 고르기`를 누르면 지도에서 자리를 찍어 위치를 바꾼다. */
  onEditLocation: () => void;
  /** 주소를 누르면 그 줄 안에서 검색해 고른 주소와 좌표로 저장한다. */
  onSaveLocation: (address: MapAddress) => Promise<void>;
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

const SAVED_TEXT = '✓ 저장했어요';

/** 기본 정보. 줄을 누르면 모달 없이 그 줄 안에서 바로 고친다. */
const PropertyBasicInfoSection = ({
  property,
  editingField,
  onEdit,
  onSaved,
  onCancel,
  onEditLocation,
  onSaveLocation,
  savedField,
  afterAddress,
}: PropertyBasicInfoSectionProps) => {
  // 이름은 등록한 뒤에도 언제든 눌러 다시 고친다. 이름 칸을 바로 열어 포커스를 두는 것은 이 세션에서 방금 만든 매물일 때뿐이다.
  // 이름과 금액이 비어 있는지로는 판단하지 않는다. 이미 등록해 둔 `새 매물`을 다시 열면 보기 모드다.
  const [isEditingName, setIsEditingName] = useState(() => isJustCreated(property.propertyId));
  useEffect(() => () => forgetJustCreated(property.propertyId), [property.propertyId]);
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
          onEdit={() => setIsEditingName(true)}
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
          onEdit={() => onEdit('location')}
          // 주소는 이름처럼 값 칸 안에서만 검색 칸으로 바뀐다. 라벨을 가리지 않고 줄 높이도 그대로다.
          // 주소는 그 줄 안에서 검색해 바꾼다. 바깥을 누르면 저장하지 않고 닫아 직전 주소가 그대로 보인다.
          editor={
            editingField === 'location' ? (
              <PropertyAddressSearchInput
                currentAddress={property.location.address ?? ''}
                onSave={onSaveLocation}
                onSaved={() => onSaved('location')}
                onCancel={onCancel}
                onPickOnMap={() => {
                  onCancel();
                  onEditLocation();
                }}
              />
            ) : undefined
          }
        />
        {afterAddress !== undefined && <div>{afterAddress}</div>}
      </PropertyInfoSection>
    </>
  );
};

export default PropertyBasicInfoSection;
