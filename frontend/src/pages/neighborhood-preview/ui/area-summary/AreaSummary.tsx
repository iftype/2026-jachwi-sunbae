import { formatManwon } from '@/features/map/api/commuteApi';

import type { AreaStation } from '../../hooks/useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import ListingLink from '../listing-link/ListingLink';

import styles from './AreaSummary.module.css';

type Area = NonNullable<NeighborhoodPreviewContext['selected']>;
type Props = {
  area: Area;
  selectedStopId: string | null;
  onSelectStation: (station: AreaStation) => void;
  onOpenListing: () => void;
};

/**
 * 데스크탑 랭킹에서 고른 동네 아래에 펼치는 요약. 동네의 경로를 바로 그리지 않고 월세 시세와 출발 정류장만 보여주며,
 * 정류장을 고르면 가운데 칸에 그 정류장에서 출발하는 경로를 연다.
 */
const AreaSummary = ({ area, selectedStopId, onSelectStation, onOpenListing }: Props) => (
  <section className={styles.summary} aria-label={`${area.name} 요약`}>
    <p className={styles.rent}>
      {area.rent
        ? `월세 ${formatManwon(area.rent.monthlyRentKrw)} / 보증금 ${formatManwon(area.rent.depositKrw)}`
        : '거래가 적어 시세를 내지 않았어요'}
    </p>
    <div>
      <h3>출발 정류장</h3>
      <ul className={styles.stations}>
        {area.stations.map((station) => (
          <li key={station.stopId}>
            <button
              type="button"
              aria-pressed={selectedStopId === station.stopId}
              onClick={() =>
                onSelectStation({
                  stopId: station.stopId,
                  name: `${station.stopName}${station.direction ? ` (${station.direction})` : ''}`,
                })
              }
            >
              <span>
                {station.stopName}
                {station.direction ? ` (${station.direction})` : ''}
              </span>
              <small>{station.travelMinutes}분</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
    <ListingLink areaName={area.name} center={area.center} onOpen={onOpenListing} />
  </section>
);

export default AreaSummary;
