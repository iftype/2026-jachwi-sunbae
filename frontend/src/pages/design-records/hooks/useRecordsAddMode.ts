import { useCallback, useEffect, useRef, useState } from 'react';

import { reverseGeocode } from '@/features/map/api/mapApi';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import type { MapAddress } from '@/features/map/model/Map';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

/** 지도에서 위치를 찍어 무엇을 추가하는지. */
export type RecordsAddKind = 'memo' | 'property';

/**
 * 휴대폰 기록 지도에서 메모·매물 위치를 찍어 고르는 모드. 찍은 좌표의 주소를 확인한다.
 * 평소에는 마커를 누르려다 잘못 찍기 쉬워, 아래쪽 추가 버튼에서 무엇을 추가할지 고른 뒤 마커를 거둔 지도에서 찍게 한다.
 */
const useRecordsAddMode = () => {
  const config = usePublicConfig();
  const [kind, setKind] = useState<RecordsAddKind | null>(null);
  const [coordinate, setCoordinate] = useState<MapCoordinate | null>(null);
  const [address, setAddress] = useState<MapAddress | null>(null);
  const [addressStatus, setAddressStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const requestRef = useRef(0);

  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    [],
  );

  const resolveAddress = useCallback(
    async (point: MapCoordinate) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setAddress(null);
      setAddressStatus('loading');
      try {
        const resolved = await reverseGeocode(config, point.latitude, point.longitude);
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

  const reset = () => {
    requestRef.current += 1;
    setCoordinate(null);
    setAddress(null);
    setAddressStatus('idle');
  };

  const enter = (next: RecordsAddKind) => {
    reset();
    setKind(next);
  };

  const cancel = () => {
    reset();
    setKind(null);
  };

  /** 지도에서 찍은 위치를 고르고 그 주소를 찾는다. 다시 찍으면 그 위치로 바꾼다. */
  const select = (point: MapCoordinate) => {
    if (kind === null) return;
    setCoordinate(point);
    void resolveAddress(point);
  };

  return { kind, isAddMode: kind !== null, coordinate, address, addressStatus, enter, cancel, select };
};

export default useRecordsAddMode;
