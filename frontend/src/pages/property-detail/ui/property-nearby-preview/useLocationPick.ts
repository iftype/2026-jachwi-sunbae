import { useEffect, useRef, useState } from 'react';

import { reverseGeocode } from '@/features/map/api/mapApi';
import type { MapAddress } from '@/features/map/model/Map';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

type PickedLocation = { address: MapAddress; status: 'geocoding' | 'ready' | 'error' };

export const pickedAddressText = (address: MapAddress) =>
  address.roadAddress ?? address.jibunAddress ?? address.address;

/**
 * 지도를 눌러 새 위치를 고르고 저장한다. 누를 때마다 주소를 다시 찾고, 늦게 온 이전 응답은 버린다.
 * `isActive`가 꺼지면 고른 자리를 비운다.
 */
const useLocationPick = (isActive: boolean, onSave?: (address: MapAddress) => Promise<void>, onDone?: () => void) => {
  const config = usePublicConfig();
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const sequenceRef = useRef(0);

  useEffect(() => {
    setPicked(null);
    setSaveFailed(false);
  }, [isActive]);

  const pick = async (latitude: number, longitude: number) => {
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const blank = { address: null, roadAddress: null, jibunAddress: null, latitude, longitude };
    setPicked({ address: blank, status: 'geocoding' });
    try {
      const address = await reverseGeocode(config, latitude, longitude);
      if (sequenceRef.current === sequence) setPicked({ address, status: 'ready' });
    } catch {
      if (sequenceRef.current === sequence) setPicked({ address: blank, status: 'error' });
    }
  };

  const save = async () => {
    if (picked?.status !== 'ready' || onSave === undefined) return;
    setIsSaving(true);
    setSaveFailed(false);
    try {
      await onSave(picked.address);
      onDone?.();
    } catch {
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  return { picked, pick, save, isSaving, saveFailed };
};

export default useLocationPick;
