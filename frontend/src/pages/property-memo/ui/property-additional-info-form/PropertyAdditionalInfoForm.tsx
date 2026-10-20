import { useState } from 'react';

import { useUpdateProperty } from '@/features/property/api/usePropertyMutations';
import { formatAmountForInput, parseMoneyInput, WON_PER_MANWON } from '@/features/property/lib/propertyForm';
import type { PropertyDetail, RoomOption, UtilityOption } from '@/features/property/model/Property';
import { MAINTENANCE_OPTIONS, PROPERTY_OPTIONS } from '@/features/property/model/propertyOptions';
import MoneyField from '@/features/property/ui/money-field/MoneyField';
import BottomActionArea from '@/shared/ui/bottom-action-area/BottomActionArea';
import { Button } from '@/shared/ui/button/Button';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import TextField from '@/shared/ui/text-field/TextField';

import PropertyOptionPicker from '../property-option-picker/PropertyOptionPicker';

import styles from './PropertyAdditionalInfoForm.module.css';

type AdditionalInfoValues = {
  availableMoveInDate: string;
  maintenanceFeeAmount: string;
  visitScheduledAt: string;
  discoverySource: string;
  roomOptions: RoomOption[];
  utilityOptions: UtilityOption[];
};

type PropertyAdditionalInfoFormProps = {
  property: PropertyDetail;
  onSaved: () => void;
  /** `page`는 제목과 화면 아래 고정 버튼을, `sheet`는 시트 제목을 쓰고 버튼을 시트 맨 아래에 둔다. */
  layout?: 'page' | 'sheet';
};

const toValues = (property: PropertyDetail): AdditionalInfoValues => ({
  availableMoveInDate: property.availableMoveInDate ?? '',
  maintenanceFeeAmount:
    property.maintenanceFeeAmount === null ? '' : formatAmountForInput(property.maintenanceFeeAmount),
  visitScheduledAt: property.visitScheduledAt?.slice(0, 16) ?? '',
  discoverySource: property.discoverySource.value,
  roomOptions: property.roomOptions,
  utilityOptions: property.utilityOptions,
});

/** 매물 상세 값으로 부가 정보를 채워 두고, 바뀐 값을 얹어 전체 수정으로 저장한다. */
const PropertyAdditionalInfoForm = ({ property, onSaved, layout = 'page' }: PropertyAdditionalInfoFormProps) => {
  const updateProperty = useUpdateProperty(property.propertyId);
  const [values, setValues] = useState(() => toValues(property));

  const setValue = <K extends keyof AdditionalInfoValues>(key: K, value: AdditionalInfoValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submitButton = (
    <Button type="submit" variant="soft" fullWidth isLoading={updateProperty.isPending} loadingLabel="저장 중…">
      부가 정보 저장
    </Button>
  );

  return (
    <form
      className={styles.form}
      data-layout={layout}
      onSubmit={(event) => {
        event.preventDefault();
        const maintenanceFeeInput =
          values.maintenanceFeeAmount === '' ? null : parseMoneyInput(values.maintenanceFeeAmount);
        if (values.maintenanceFeeAmount !== '' && maintenanceFeeInput === null) return;

        void updateProperty
          .mutateAsync({
            current: property,
            changes: {
              availableMoveInDate: values.availableMoveInDate || null,
              maintenanceFeeAmount: maintenanceFeeInput === null ? null : maintenanceFeeInput * WON_PER_MANWON,
              visitScheduledAt: values.visitScheduledAt || null,
              discoverySource: values.discoverySource.trim() || null,
              roomOptions: values.roomOptions,
              utilityOptions: values.utilityOptions,
            },
          })
          .then(onSaved)
          .catch(() => undefined);
      }}
    >
      <section
        className={styles.fields}
        aria-labelledby={layout === 'page' ? 'additional-info-heading' : undefined}
        aria-label={layout === 'sheet' ? '부가 정보 입력' : undefined}
      >
        {layout === 'page' && <h1 id="additional-info-heading">부가 정보</h1>}
        <TextField
          label="입주 가능일"
          type="date"
          value={values.availableMoveInDate}
          onChange={(event) => setValue('availableMoveInDate', event.target.value)}
        />
        <PropertyOptionPicker
          label="관리비 포함 공과금"
          options={MAINTENANCE_OPTIONS}
          variant="badge"
          selected={values.utilityOptions}
          onChange={(next) => setValue('utilityOptions', next as UtilityOption[])}
        >
          <MoneyField
            label="총 관리비"
            value={values.maintenanceFeeAmount}
            placeholder="예: 10"
            onValueChange={(value) => setValue('maintenanceFeeAmount', value)}
          />
        </PropertyOptionPicker>
        <PropertyOptionPicker
          label="방 옵션"
          options={PROPERTY_OPTIONS}
          selected={values.roomOptions}
          onChange={(next) => setValue('roomOptions', next as RoomOption[])}
        />
        <TextField
          label="방문 일정"
          type="datetime-local"
          value={values.visitScheduledAt}
          onChange={(event) => setValue('visitScheduledAt', event.target.value)}
        />
        <TextField
          label="확인한 곳"
          value={values.discoverySource}
          maxLength={500}
          placeholder="URL, 앱 이름 또는 중개사 정보"
          onChange={(event) => setValue('discoverySource', event.target.value)}
        />
      </section>
      {updateProperty.isError && (
        <InlineNotice tone="error">부가 정보를 저장하지 못했어요. 다시 시도해 주세요.</InlineNotice>
      )}
      {layout === 'page' ? <BottomActionArea>{submitButton}</BottomActionArea> : submitButton}
    </form>
  );
};

export default PropertyAdditionalInfoForm;
