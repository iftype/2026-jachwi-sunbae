import { useState } from 'react';

import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import Icon from '@/shared/ui/icon/Icon';

import { type NeighborhoodPlace, placeTitle } from '../../hooks/useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import PlaceDetails from './PlaceDetails';

import styles from './NeighborhoodPlacePanel.module.css';

type Props = {
  place: NeighborhoodPlace;
  preview: Pick<NeighborhoodPreviewContext, 'destination' | 'maxMinutes' | 'maxTransfers'>;
  onClose: () => void;
};

/**
 * 휴대폰에서 지도의 정류장·부동산을 고르면 아래에 높이가 고정된 시트로 띄운다.
 * 정류장은 예상 시간만 요약하고 `경로 자세히 보기`로 전체 화면 경로를 열며, 부동산은 시트에서 바로 전화를 건다.
 */
const NeighborhoodPlaceSheet = ({ place, preview, onClose }: Props) => {
  const [routeOpenFor, setRouteOpenFor] = useState<string | null>(null);
  const title = placeTitle(place);
  const placeKey = title;
  if (place.kind !== 'agency' && routeOpenFor === placeKey)
    return (
      <section className={styles.screen} aria-label={`${title} 출발 경로`}>
        <header className={styles.screenHeader}>
          <button type="button" aria-label="경로 닫기" onClick={() => setRouteOpenFor(null)}>
            <Icon name="close" size={24} />
          </button>
          <h1>{title}에서 출발</h1>
        </header>
        <PlaceDetails place={place} preview={preview} phoneAction="call" />
      </section>
    );
  return (
    <BottomSheet
      title={`${title} 정보`}
      initialHeightPercent={place.kind === 'agency' ? 32 : 28}
      resizable={false}
      closeLabel="정보 닫기"
      onClose={onClose}
    >
      <PlaceDetails
        place={place}
        preview={preview}
        phoneAction="call"
        onOpenRoute={place.kind !== 'agency' ? () => setRouteOpenFor(placeKey) : undefined}
      />
    </BottomSheet>
  );
};

export default NeighborhoodPlaceSheet;
