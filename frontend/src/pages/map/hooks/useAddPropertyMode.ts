import { useCallback, useEffect, useRef, useState } from 'react';

import { reverseGeocode } from '@/features/map/api/mapApi';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import type { MapAddress } from '@/features/map/model/Map';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

const ADDRESS_RESOLVE_DELAY_MS = 450;

/** 지도 중앙 핀으로 매물 위치를 고르는 모드. 지도가 멈추면 중앙 좌표의 주소를 확인한다. */
const useAddPropertyMode = () => {
  const config = usePublicConfig();
  const [isAddMode, setIsAddMode] = useState(false);
  const [address, setAddress] = useState<MapAddress | null>(null);
  const [addressStatus, setAddressStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const requestRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(
    () => () => {
      clearTimer();
      requestRef.current += 1;
    },
    [],
  );

  const resolveAddress = useCallback(
    async (coordinate: MapCoordinate) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setAddress(null);
      setAddressStatus('loading');
      try {
        const resolved = await reverseGeocode(config, coordinate.latitude, coordinate.longitude);
        if (requestRef.current !== requestId) return;
        setAddress(resolved);
        setAddressStatus('idle');
      } catch {
        if (requestRef.current !== requestId) return;
        setAddress(null);
        setAddressStatus('error');
      }
    },
    [config],
  );

  const enter = (center: MapCoordinate) => {
    clearTimer();
    setIsAddMode(true);
    void resolveAddress(center);
  };

  const cancel = () => {
    clearTimer();
    requestRef.current += 1;
    setAddress(null);
    setAddressStatus('idle');
    setIsAddMode(false);
  };

  const handleCenterChange = (coordinate: MapCoordinate) => {
    if (!isAddMode) return;
    clearTimer();
    // 새 좌표의 조회를 기다리는 동안 이전 주소를 저장하지 못하도록 즉시 무효화한다.
    requestRef.current += 1;
    setAddress(null);
    setAddressStatus('loading');
    timerRef.current = window.setTimeout(() => void resolveAddress(coordinate), ADDRESS_RESOLVE_DELAY_MS);
  };

  return { isAddMode, address, addressStatus, enter, cancel, handleCenterChange };
};

export default useAddPropertyMode;
