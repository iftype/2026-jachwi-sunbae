import { css } from '@emotion/css';
import { useState } from 'react';

import PropertyAdditionalInfoForm from '@/pages/property-memo/ui/property-additional-info-form/PropertyAdditionalInfoForm';
import { formatManwon } from '@/features/property/lib/propertyFormat';
import type { PropertyDetail } from '@/features/property/model/Property';
import { roomOptionLabels, utilityOptionLabels } from '@/features/property/model/propertyOptions';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import InfoValue from '@/shared/ui/info-value/InfoValue';

import type { AdditionalEditField, PropertyEditField } from '../../model/editField';
import PropertyInfoSection from '../property-info-section/PropertyInfoSection';
import PropertyEditToggle from '../PropertyEditToggle';

type PropertyAdditionalInfoSectionProps = {
  property: PropertyDetail;
  /** 지금 그 줄 안에서 고치고 있는 항목. 상세 화면 하나에서 한 번에 한 줄만 연다. */
  editingField: PropertyEditField | null;
  /** 누른 항목을 그 줄 안의 입력으로 연다. */
  onEdit: (field: AdditionalEditField) => void;
  onSaved: (field: AdditionalEditField) => void;
  onCancel: () => void;
  /** 방금 저장한 항목. 그 줄 값 아래에 잠깐 저장했다고 알린다. */
  savedField: PropertyEditField | null;
};

const formatDate = (value: string | null): string => value?.replace(/-/g, '.') ?? '';
// LocalDateTime은 초가 0이면 초 자리를 생략해서 온다. 초가 붙어 온 경우에만 잘라낸다.
const formatDateTime = (value: string | null): string =>
  value === null ? '' : value.replace('T', ' ').replace(/(\d{2}:\d{2}):\d{2}(?:\.\d+)?$/, '$1');

const SAVED_TEXT = '✓ 저장했어요';

const SHEET_TITLES: Record<Exclude<AdditionalEditField, 'discoverySource'>, string> = {
  availableMoveInDate: '입주 가능일',
  maintenance: '관리비와 공과금',
  roomOptions: '방 옵션',
  visitScheduledAt: '방문 일정',
};

/** 시트 높이(%). 내용만큼만 낮게 연다. 키패드가 오르면 시트(`BottomSheet`)가 키패드 높이만큼 스스로 올라가므로 키패드를 위해 높게 열지 않는다. */
const SHEET_HEIGHTS: Record<Exclude<AdditionalEditField, 'discoverySource'>, number> = {
  availableMoveInDate: 30,
  visitScheduledAt: 30,
  roomOptions: 44,
  maintenance: 44,
};

const isAdditionalField = (field: PropertyEditField): field is Exclude<AdditionalEditField, 'discoverySource'> =>
  field in SHEET_TITLES;

/**
 * 새 매물 API가 돌려준 부가 정보를 그대로 표시하고, 줄을 누르면 모달 없이 그 줄 안에서 그 항목만 고친다.
 * 관리비와 공과금은 한 입력에서 함께 고치므로, 고치는 동안에는 관리비 줄에 입력을 펼치고 공과금 줄은 접는다.
 */
const PropertyAdditionalInfoSection = ({
  property,
  editingField,
  onEdit,
  onSaved,
  onCancel,
  savedField,
}: PropertyAdditionalInfoSectionProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  // 확인한 곳은 글자 하나만 고치므로 값 자리에서 바로 고친다. 나머지는 시트에서 고친다(날짜와 일정은 데스크탑만 제외).
  const isDesktop = useIsDesktop();
  // 날짜와 일정은 데스크탑에서는 값 자리에서 바로 고치고, 휴대폰에서는 시트에서 고친다.
  const isInlineField = (field: AdditionalEditField) =>
    field === 'discoverySource' || (isDesktop && (field === 'availableMoveInDate' || field === 'visitScheduledAt'));
  const row = (field: AdditionalEditField) => ({
    onEdit: isEditMode ? () => onEdit(field) : undefined,
    editor:
      isInlineField(field) && editingField === field ? (
        <PropertyAdditionalInfoForm
          property={property}
          layout="inline"
          field={field}
          onSaved={() => onSaved(field)}
          onCancel={onCancel}
        />
      ) : undefined,
    editorLayout: 'inline' as const,
    feedback: savedField === field ? SAVED_TEXT : undefined,
  });
  const sheetField =
    editingField !== null && isAdditionalField(editingField) && !isInlineField(editingField) ? editingField : null;

  return (
    <>
      <PropertyInfoSection
        title="부가 정보"
        label="매물 부가 정보"
        meta={
          <PropertyEditToggle
            section="부가 정보"
            isEditing={isEditMode}
            onToggle={() => {
              onCancel();
              setIsEditMode((current) => !current);
            }}
          />
        }
      >
        <InfoValue
          label="입주 가능일"
          value={formatDate(property.availableMoveInDate)}
          {...row('availableMoveInDate')}
        />
        <InfoValue
          label="관리비"
          value={property.maintenanceFeeAmount === null ? '' : formatManwon(property.maintenanceFeeAmount)}
          {...row('maintenance')}
        />
        <InfoValue
          label="관리비 포함 공과금"
          value={utilityOptionLabels(property.utilityOptions)}
          onEdit={isEditMode ? () => onEdit('maintenance') : undefined}
        />
        <InfoValue label="방 옵션" value={roomOptionLabels(property.roomOptions)} {...row('roomOptions')} />
        <InfoValue label="방문 일정" value={formatDateTime(property.visitScheduledAt)} {...row('visitScheduledAt')} />
        <InfoValue label="확인한 곳" value={property.discoverySource.value} {...row('discoverySource')} />
      </PropertyInfoSection>
      {sheetField !== null && isAdditionalField(sheetField) && (
        <BottomSheet
          title={SHEET_TITLES[sheetField]}
          initialHeightPercent={SHEET_HEIGHTS[sheetField]}
          resizable={false}
          closeLabel="닫기"
          onClose={onCancel}
          className={styles.sheet}
        >
          <div className={styles.sheetBody}>
            <PropertyAdditionalInfoForm
              property={property}
              layout="sheet"
              field={sheetField}
              onSaved={() => onSaved(sheetField)}
              onCancel={onCancel}
            />
          </div>
        </BottomSheet>
      )}
    </>
  );
};

const styles = {
  /*
   * 휴대폰 상세는 페이지 전체가 스크롤되므로, 시트를 화면에 고정해 스크롤해도 따라 내려가지 않게 한다.
   * 데스크탑은 상세가 본 방 기록 옆 칸 안에 열려, 화면에 고정하면 칸을 넘어 지도를 덮는다. 그래서 휴대폰에서만 고정한다.
   */
  sheet: css`
    label: PropertyAdditionalInfoSection-sheet;
    @media (max-width: 1023px) {
      && {
        position: fixed;
      }
    }
  `,
  sheetBody: css`
    label: PropertyAdditionalInfoSection-sheetBody;
    padding: 0 1rem calc(1rem + env(safe-area-inset-bottom));
  `,
};

export default PropertyAdditionalInfoSection;
