import { type NeighborhoodPlace, placeTitle } from '../../hooks/useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import PlaceDetails from './PlaceDetails';

import styles from './NeighborhoodPlacePanel.module.css';

type Props = {
  place: NeighborhoodPlace;
  preview: Pick<NeighborhoodPreviewContext, 'destination' | 'maxMinutes' | 'maxTransfers'>;
};

/** 데스크탑에서 지도의 정류장·부동산을 고르면 랭킹 옆 칸에 바로 여는 정보. 칸이 넓어 요약 단계 없이 경로까지 보여준다. */
const NeighborhoodPlacePanel = ({ place, preview }: Props) => {
  const title = placeTitle(place);
  return (
    <section className={styles.panel} aria-label={`${title} 정보`}>
      <h1 className={styles.title}>{title}</h1>
      <PlaceDetails place={place} preview={preview} phoneAction="copy" />
    </section>
  );
};

export default NeighborhoodPlacePanel;
