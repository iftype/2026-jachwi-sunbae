import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import type { MapAddress } from '@/features/map/model/Map';
import type { PropertyInputDto } from '@/features/property/api/dtos/PropertyDto';
import { useCreateProperty } from '@/features/property/api/usePropertyMutations';
import { trackPropertyEvent } from '@/features/property/lib/propertyAnalytics';
import type { PropertyFormErrors, PropertyFormValues } from '@/features/property/lib/propertyForm';
import { formatAmountForInput, toPropertyInputDto, validatePropertyForm } from '@/features/property/lib/propertyForm';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

import useAddressSearch from './useAddressSearch';
import usePropertyLocation from './usePropertyLocation';

export type PropertyCreationRouteState = { registrationDraft?: PropertyInputDto; selectedLocation?: MapAddress };
export const DEFAULT_PROPERTY_NAME = '새 매물';
const stepEvents = {
  deposit: 'property_creation_deposit_completed',
  monthly_rent: 'property_creation_monthly_rent_completed',
  address: 'property_creation_address_completed',
  name: 'property_creation_name_completed',
} as const;
const emptyValues: PropertyFormValues = {
  name: DEFAULT_PROPERTY_NAME,
  depositAmount: '',
  monthlyRentAmount: '',
  discoverySource: '',
};
const draftToValues = (draft: PropertyInputDto | undefined): PropertyFormValues =>
  draft === undefined
    ? emptyValues
    : {
        name: draft.name,
        depositAmount: formatAmountForInput(draft.depositAmount),
        monthlyRentAmount: formatAmountForInput(draft.monthlyRentAmount),
        discoverySource: draft.discoverySource ?? '',
        address: draft.address ?? '',
        latitude: draft.latitude,
        longitude: draft.longitude,
      };
/**
 * 보증금 → 월세 → (위치) → 이름 순서로 한 칸씩 열어 가며 매물을 등록한다.
 * 지도에서 위치를 골라 들어왔다면 위치 단계는 건너뛴다.
 */
export const usePropertyCreationForm = (routeState: PropertyCreationRouteState) => {
  const navigate = useNavigate();
  const hasPresetLocation = routeState.selectedLocation !== undefined;
  const entrypoint = hasPresetLocation ? 'map' : 'form';
  const hasTrackedStart = useRef(false);
  const nameStep = hasPresetLocation ? 2 : 3;
  const [values, setValues] = useState<PropertyFormValues>(() => {
    const draft = draftToValues(routeState.registrationDraft);
    const selected = routeState.selectedLocation;
    return selected === undefined
      ? draft
      : {
          ...draft,
          address: selected.roadAddress ?? selected.jibunAddress ?? selected.address ?? '',
          latitude: selected.latitude,
          longitude: selected.longitude,
        };
  });
  const [errors, setErrors] = useState<PropertyFormErrors>({});
  const [revealedStep, setRevealedStep] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  const createProperty = useCreateProperty(entrypoint);
  const clearCreateError = useCallback(() => setCreateError(null), []);
  const location = usePropertyLocation(routeState.selectedLocation, clearCreateError);
  const search = useAddressSearch();

  useEffect(() => {
    if (hasTrackedStart.current) return;
    hasTrackedStart.current = true;
    trackPropertyEvent('property_creation_started', { entrypoint });
  }, [entrypoint]);

  useEffect(() => {
    if (location.locationStatus !== 'ready') return;
    const address =
      location.selectedLocation.roadAddress ??
      location.selectedLocation.jibunAddress ??
      location.selectedLocation.address;
    if (address !== null && address !== undefined && address !== '') search.setInitialQuery(address);
  }, [
    location.locationStatus,
    location.selectedLocation.address,
    location.selectedLocation.jibunAddress,
    location.selectedLocation.roadAddress,
    search.setInitialQuery,
  ]);

  const changeMoney = (field: 'depositAmount' | 'monthlyRentAmount', formatted: string) => {
    setValues((current) => ({ ...current, [field]: formatted }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /** 기본 이름은 입력을 시작할 때 비워 준다. */
  const focusName = () => {
    if (values.name === DEFAULT_PROPERTY_NAME) setValues((current) => ({ ...current, name: '' }));
  };

  const changeName = (event: ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    setValues((current) => ({ ...current, name }));
    setErrors((current) => ({ ...current, name: undefined }));
  };

  const submitProperty = async () => {
    const validationErrors = validatePropertyForm(values);
    setErrors(validationErrors);
    if (validationErrors.address !== undefined) {
      setCreateError(validationErrors.address);
      return;
    }
    if (Object.keys(validationErrors).length > 0) return;
    if (location.locationStatus !== 'ready') {
      setCreateError(
        location.locationStatus === 'loading'
          ? '주소를 확인하는 중이에요. 잠시 뒤에 다시 눌러 주세요.'
          : '주소를 확인하지 못했어요. 지도를 움직이거나 주소를 검색해 위치를 다시 선택해 주세요.',
      );
      return;
    }
    const input = toPropertyInputDto(values);
    if (input === null) return;
    setCreateError(null);
    trackPostHogEvent(stepEvents.name);
    const { selectedLocation } = location;
    try {
      const created = await createProperty.mutateAsync({
        ...input,
        address: selectedLocation.roadAddress ?? selectedLocation.jibunAddress ?? selectedLocation.address,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      });
      navigate(`/properties/${created.propertyId}`, { replace: true });
    } catch {
      setCreateError('매물을 등록하지 못했어요. 입력한 정보는 유지되니 다시 시도해 주세요.');
    }
  };

  const submitStep = (event: FormEvent) => {
    event.preventDefault();
    const next: PropertyFormErrors = {};
    const validationErrors = validatePropertyForm(values);
    if (values.depositAmount.length === 0 || validationErrors.depositAmount !== undefined) {
      next.depositAmount = validationErrors.depositAmount ?? '보증금을 입력해 주세요.';
    }
    if (
      revealedStep >= 1 &&
      (values.monthlyRentAmount.length === 0 || validationErrors.monthlyRentAmount !== undefined)
    ) {
      next.monthlyRentAmount = validationErrors.monthlyRentAmount ?? '월세를 입력해 주세요.';
    }
    if (revealedStep >= nameStep && (values.name.trim().length === 0 || validationErrors.name !== undefined)) {
      next.name = validationErrors.name ?? '매물 이름을 입력해 주세요.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (revealedStep === 0) {
      trackPostHogEvent(stepEvents.deposit);
      setRevealedStep(1);
      return;
    }
    if (revealedStep === 1) {
      trackPostHogEvent(stepEvents.monthly_rent);
      setRevealedStep(2);
      return;
    }
    if (!hasPresetLocation && revealedStep === 2) {
      trackPostHogEvent(stepEvents.address);
      setRevealedStep(3);
      return;
    }
    void submitProperty();
  };

  /** 현재 위치 확인도 주소 검색 영역에 진행 상태를 보여 준다. */
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

  const selectSearchResult = (result: MapAddress) => {
    location.selectAddress(result);
    search.pick(result);
  };

  return {
    values,
    errors,
    revealedStep,
    nameStep,
    hasPresetLocation,
    createError,
    isCreating: createProperty.isPending,
    changeMoney,
    focusName,
    changeName,
    submitStep,
    location: {
      selected: location.selectedLocation,
      status: location.locationStatus,
      onCenterChange: location.handleCenterChange,
      onMoveToCurrentLocation: () => void moveToCurrentLocation(),
    },
    search: {
      query: search.query,
      results: search.results,
      status: search.status,
      onQueryChange: search.changeQuery,
      onSubmit: () => void search.submit(),
      onClear: search.clear,
      onSelect: selectSearchResult,
    },
  };
};
