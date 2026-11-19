import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import { DESKTOP_MAP_CONTROLS_RIGHT, DESKTOP_MAP_LOCATE_BOTTOM } from '@/features/map/lib/mapControlsLayout';
import MapCurrentLocationButton from '@/features/map/ui/map-current-location-button/MapCurrentLocationButton';
import MapZoomControl from '@/features/map/ui/map-zoom-control/MapZoomControl';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';

import * as shared from '../../NeighborhoodPreviewPage.styles';

type LocationControlsProps = {
  preview: Pick<NeighborhoodPreviewContext, 'isLocating' | 'locationError' | 'moveToCurrentLocation'>;
  /** 결과 화면이면 아래 카드 레일을 피해 더 위에 둔다. */
  isResult: boolean;
  /** 조건 칸 아래 피커가 펼쳐져 카드가 높아지면 그만큼 올린다. */
  isFilterOpen?: boolean;
  /** 주면 현재 위치 버튼 위에 확대(+), 축소(-) 버튼을 둔다. 장소 고르기와 결과 지도 모두 넘겨, 두 손가락이나 휠 없이도 확대 단계를 바꾼다. */
  zoom?: { level: number; onZoom: (delta: -1 | 1) => void };
  /** 바텀시트 위에 붙여 띄운다(`BottomSheet`의 `floating`). 시트가 자리를 정하므로 지도 위 고정 위치를 쓰지 않는다. */
  docked?: boolean;
  /**
   * 동네를 고른 결과 지도의 분류 레일(`MapCategoryRail`). 주면 본 방 기록 지도처럼 지도 오른쪽 위에
   * 확대·축소, 레일, 현재 위치 버튼을 위에서부터 한 줄로 세운다. 놓을 높이는 `className`으로 정한다.
   */
  rail?: ReactNode;
  /** 켜면 현재 위치 버튼과 위치 확인 말풍선을 이 열에서 떼어 지도 오른쪽 아래 모서리에 둔다(데스크탑). */
  locateAtCorner?: boolean;
  className?: string;
};

/** 지도 오른쪽 아래 현재 위치 버튼과 위치 확인 상태 말풍선. `zoom`을 주면 그 위에 확대, 축소 버튼을 둔다. */
const LocationControls = ({
  preview,
  isResult,
  isFilterOpen = false,
  zoom,
  docked = false,
  rail,
  locateAtCorner = false,
  className,
}: LocationControlsProps) => {
  const locate = (
    <>
      {(preview.isLocating || preview.locationError) && (
        <span className={shared.locationStatus} role={preview.locationError ? 'alert' : 'status'}>
          {preview.isLocating ? '현재 위치를 확인하는 중이에요.' : preview.locationError}
        </span>
      )}
      <MapCurrentLocationButton isLocating={preview.isLocating} onClick={preview.moveToCurrentLocation} />
    </>
  );
  return (
    <>
      <div
        className={[shared.locationControls, rail ? styles.railed : undefined, className].filter(Boolean).join(' ')}
        data-docked={(docked && !rail) || undefined}
        // 시트 위에 붙이거나 레일과 함께 오른쪽 위에 세우면 결과 화면용 높이(카드 레일, 기록 버튼 피하기)를 쓰지 않는다.
        data-result={(isResult && !docked && !rail) || undefined}
        data-filter-open={isFilterOpen || undefined}
      >
        {zoom && (
          <MapZoomControl
            className={styles.zoom}
            level={zoom.level}
            onChange={(next) => zoom.onZoom(next < zoom.level ? -1 : 1)}
          />
        )}
        {rail}
        {!locateAtCorner && locate}
      </div>
      {locateAtCorner && <div className={styles.corner}>{locate}</div>}
    </>
  );
};

const styles = {
  /* 데스크탑에서는 현재 위치 버튼을 오른쪽 컨트롤 열과 따로 지도 오른쪽 아래 모서리에 둔다. */
  corner: css`
    label: LocationControls-corner;
    position: absolute;
    z-index: 30;
    right: ${DESKTOP_MAP_CONTROLS_RIGHT};
    bottom: ${DESKTOP_MAP_LOCATE_BOTTOM};
  `,

  /* 레일과 함께 세우면 오른쪽 끝을 맞춰 위에서부터 쌓는다. 레일의 원래 자리(absolute)는 풀어 이 줄에 넣는다. */
  railed: css`
    label: LocationControls-railed;

    && {
      bottom: auto;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.6rem;
    }

    && > aside {
      position: static;
    }

    && > [role='group'] {
      margin-bottom: 0;
    }
  `,

  /* 현재 위치 버튼 바로 위에 세로로 쌓는다. 오른쪽 끝을 맞춰 두 버튼이 한 줄로 보이게 한다. */
  zoom: css`
    label: LocationControls-zoom;
    position: static;
    margin-bottom: 0.6rem;
    margin-left: auto;
    width: max-content;
  `,
};

export default LocationControls;
