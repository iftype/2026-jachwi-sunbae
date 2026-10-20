import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import useAddressSearch from '@/pages/create-property/hooks/useAddressSearch';
import usePropertyLocation from '@/pages/create-property/hooks/usePropertyLocation';
import PropertyLocationPicker from '@/pages/create-property/ui/property-location-picker/PropertyLocationPicker';
import { requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import type { MapAddress } from '@/features/map/model/Map';
import { useUpdateProperty } from '@/features/property/api/usePropertyMutations';
import {
  formatAmountForInput,
  parseMoneyInput,
  type PropertyFormErrors,
  validatePropertyForm,
  WON_PER_MANWON,
} from '@/features/property/lib/propertyForm';
import type { PropertyDetail } from '@/features/property/model/Property';
import MoneyField from '@/features/property/ui/money-field/MoneyField';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';
import { Button } from '@/shared/ui/button/Button';
import TextField from '@/shared/ui/text-field/TextField';

import styles from '../property-edit-sheet/PropertyEditSheet.module.css';

type PropertyBasicInfoFormProps = {
  property: PropertyDetail;
  onSaved: () => void;
};

type BasicInfoValues = { name: string; depositAmount: string; monthlyRentAmount: string };

/** 지도 idle 때 같은 좌표가 다시 들어와도 위치를 바꾼 것으로 보지 않는다. */
const COORDINATE_EPSILON = 1e-6;

const toPresetLocation = ({ location }: PropertyDetail): MapAddress | undefined =>
  location.latitude === null || location.longitude === null
    ? undefined
    : {
        address: location.address,
        roadAddress: null,
        jibunAddress: null,
        latitude: location.latitude,
        longitude: location.longitude,
      };

/**
 * 상세 시트에서 새 매물 등록과 같은 기본 정보(이름·보증금·월세·위치)를 고친다.
 * 위치는 지도를 옮기거나 주소를 고른 경우에만 보낸다.
 */
const PropertyBasicInfoForm = ({ property, onSaved }: PropertyBasicInfoFormProps) => {
  const updateProperty = useUpdateProperty(property.propertyId);
  const [values, setValues] = useState<BasicInfoValues>({
    name: property.name,
    depositAmount: formatAmountForInput(property.depositAmount),
    monthlyRentAmount: formatAmountForInput(property.monthlyRentAmount),
  });
  const [errors, setErrors] = useState<PropertyFormErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [presetLocation] = useState(() => toPresetLocation(property));
  const clearNotice = useCallback(() => setNotice(null), []);
  const location = usePropertyLocation(presetLocation, clearNotice);
  const search = useAddressSearch();
  const initialCoordinate = useRef({
    latitude: location.selectedLocation.latitude,
    longitude: location.selectedLocation.longitude,
  });
  const { setInitialQuery } = search;

  useEffect(() => {
    if (property.location.address) setInitialQuery(property.location.address);
  }, [property.location.address, setInitialQuery]);

  const setValue = (field: keyof BasicInfoValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const moveToCurrentLocation = async () => {
    search.setStatus('loading');
    try {
      const coordinate = await requestCurrentMapLocation();
      await location.resolveLocation(coordinate.latitude, coordinate.longitude);
      search.setStatus('idle');
    } catch {
      trackPostHogEvent('address_search_failed', { error_kind: 'location' });
      search.setStatus('error');
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validatePropertyForm({ ...values, discoverySource: property.discoverySource.value });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const { selectedLocation, locationStatus } = location;
    const moved =
      Math.abs(selectedLocation.latitude - initialCoordinate.current.latitude) > COORDINATE_EPSILON ||
      Math.abs(selectedLocation.longitude - initialCoordinate.current.longitude) > COORDINATE_EPSILON;
    if (moved && locationStatus !== 'ready') {
      setNotice(
        locationStatus === 'loading'
          ? '주소를 확인하는 중이에요. 잠시 후 다시 눌러 주세요.'
          : '위치를 다시 선택해 주세요.',
      );
      return;
    }

    void updateProperty
      .mutateAsync({
        current: property,
        changes: {
          name: values.name.trim(),
          depositAmount: (parseMoneyInput(values.depositAmount) ?? 0) * WON_PER_MANWON,
          monthlyRentAmount: (parseMoneyInput(values.monthlyRentAmount) ?? 0) * WON_PER_MANWON,
          ...(moved
            ? {
                address: selectedLocation.roadAddress ?? selectedLocation.jibunAddress ?? selectedLocation.address,
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
              }
            : {}),
        },
      })
      .then(onSaved)
      .catch(() => undefined);
  };

  return (
    <form className={styles.editor} noValidate onSubmit={submit}>
      <TextField
        label="매물 이름"
        maxLength={30}
        value={values.name}
        error={errors.name}
        onChange={(event) => setValue('name', event.target.value)}
      />
      <MoneyField
        label="보증금"
        value={values.depositAmount}
        error={errors.depositAmount}
        onValueChange={(value) => setValue('depositAmount', value)}
      />
      <MoneyField
        label="월세"
        value={values.monthlyRentAmount}
        error={errors.monthlyRentAmount}
        onValueChange={(value) => setValue('monthlyRentAmount', value)}
      />
      <PropertyLocationPicker
        location={{
          selected: location.selectedLocation,
          status: location.locationStatus,
          onCenterChange: location.handleCenterChange,
          onMoveToCurrentLocation: () => void moveToCurrentLocation(),
        }}
        search={{
          query: search.query,
          results: search.results,
          status: search.status,
          onQueryChange: search.changeQuery,
          onSubmit: () => void search.submit(),
          onClear: search.clear,
          onSelect: (result) => {
            location.selectAddress(result);
            search.pick(result);
          },
        }}
      />
      {notice !== null && (
        <p className={styles.errorNotice} role="alert">
          {notice}
        </p>
      )}
      {updateProperty.isError && (
        <p className={styles.errorNotice} role="alert">
          기본 정보를 저장하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
      <Button type="submit" variant="soft" fullWidth isLoading={updateProperty.isPending} loadingLabel="저장 중…">
        기본 정보 저장
      </Button>
    </form>
  );
};

export default PropertyBasicInfoForm;
