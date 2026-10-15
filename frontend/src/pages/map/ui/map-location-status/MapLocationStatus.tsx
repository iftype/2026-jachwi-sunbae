import type { MapLocationFailure } from '@/features/map/lib/mapLocation';

import styles from './MapLocationStatus.module.css';

type LocationStatus = 'locating' | 'ready' | 'fallback';

const LOCATION_FAILURE_TEXT: Record<MapLocationFailure, string> = {
  denied: '위치 권한이 꺼져 있어요. 브라우저 주소창에서 위치를 허용해 주세요.',
  insecure: 'https 주소에서만 현재 위치를 쓸 수 있어요.',
  unavailable: '현재 위치를 찾지 못했어요.',
};

type MapLocationStatusProps = {
  status: LocationStatus;
  failure: MapLocationFailure;
  canRetry: boolean;
  permission: PermissionState | 'unknown';
  onRetry: () => void;
  className?: string;
};

const MapLocationStatus = ({
  status,
  failure,
  canRetry,
  permission,
  onRetry,
  className = '',
}: MapLocationStatusProps) => {
  if (status === 'ready') return null;

  return (
    <div
      className={`${styles.status} ${className}`}
      role={status === 'fallback' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <span>{status === 'locating' ? '현재 위치를 확인하는 중이에요.' : LOCATION_FAILURE_TEXT[failure]}</span>
      {status === 'fallback' && canRetry && (
        <button type="button" onClick={onRetry}>
          {permission === 'prompt' ? '위치 허용' : '다시 시도'}
        </button>
      )}
    </div>
  );
};

export default MapLocationStatus;
