import { css } from '@emotion/css';
import { useState } from 'react';

import { UNSUPPORTED_ADDRESS_MESSAGE } from '@/features/map/lib/mapAddress';
import { formatPropertyPrice, hasPropertyPrice } from '@/features/property/lib/propertyFormat';
import type { PropertyDetail } from '@/features/property/model/Property';
import { usePropertyAiImport } from '@/features/property/model/usePropertyAiImport';
import InfoValue from '@/shared/ui/info-value/InfoValue';

import type { BasicEditField, PropertyEditField } from '../../model/editField';
import PropertyInfoSection from '../property-info-section/PropertyInfoSection';
import PropertyAiImportButton from './PropertyAiImportButton';
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
  savedField,
}: PropertyBasicInfoSectionProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const aiImport = usePropertyAiImport(property.propertyId);
  return (
    <>
      <PropertyInfoSection
        title="기본 정보"
        label="매물 기본 정보"
        action={
          <PropertyAiImportButton
            isImporting={aiImport.isImporting}
            onSelectFiles={(files) => void aiImport.importFiles(files)}
          />
        }
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
          feedback={savedField === 'price' ? SAVED_TEXT : undefined}
        />
        <InfoValue
          label="주소"
          value={property.location.address ?? ''}
          emptyText={UNSUPPORTED_ADDRESS_MESSAGE}
          onEdit={onEditLocation}
          feedback={savedField === 'location' ? SAVED_TEXT : undefined}
        />
      </PropertyInfoSection>
      {aiImport.isImporting ? (
        <p className={styles.aiImportFeedback} role="status">
          이미지를 분석하고 있어요. 1분 정도 걸릴 수 있어요.
        </p>
      ) : (
        aiImport.feedback !== null && (
          <p
            className={styles.aiImportFeedback}
            data-tone={aiImport.feedback.tone}
            role={aiImport.feedback.tone === 'error' ? 'alert' : 'status'}
          >
            {aiImport.feedback.message}
          </p>
        )
      )}
    </>
  );
};

const styles = {
  aiImportFeedback: css`
    label: PropertyBasicInfoSection-aiImportFeedback;
    margin: 0 0 0.75rem;
    color: var(--color-muted);
    font-size: 0.75rem;
    line-height: 1.5;

    &[data-tone='error'] {
      color: var(--color-error);
    }
  `,
};

export default PropertyBasicInfoSection;
