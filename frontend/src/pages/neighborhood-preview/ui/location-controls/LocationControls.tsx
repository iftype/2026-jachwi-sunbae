import MapCurrentLocationButton from '@/features/map/ui/map-current-location-button/MapCurrentLocationButton';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';

import shared from '../../NeighborhoodPreviewPage.module.css';

type LocationControlsProps = {
  preview: Pick<NeighborhoodPreviewContext, 'isLocating' | 'locationError' | 'moveToCurrentLocation'>;
  /** 결과 화면이면 아래 카드 레일을 피해 더 위에 둔다. */
  isResult: boolean;
  isFilterOpen?: boolean;
};

/** 지도 오른쪽 아래 현재 위치 버튼과 위치 확인 상태 말풍선. */
const LocationControls = ({ preview, isResult, isFilterOpen = false }: LocationControlsProps) => (
  <div
    className={shared.locationControls}
    data-result={isResult || undefined}
    data-filter-open={isFilterOpen || undefined}
  >
    {(preview.isLocating || preview.locationError) && (
      <span className={shared.locationStatus} role={preview.locationError ? 'alert' : 'status'}>
        {preview.isLocating ? '현재 위치를 확인하는 중이에요.' : preview.locationError}
      </span>
    )}
    <MapCurrentLocationButton isLocating={preview.isLocating} onClick={preview.moveToCurrentLocation} />
  </div>
);

export default LocationControls;
