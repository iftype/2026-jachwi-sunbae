import { useEffect, useState } from 'react';

import { getMapCategoryLabel } from '@/features/map/lib/mapPresentation';
import { distanceMeters } from '@/features/map/lib/mapViewportQuery';
import { transitStopIdForBusStop } from '@/features/map/lib/transitStop';

import type { NeighborhoodPlace } from '../../hooks/useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import usePlaceRoute from '../../hooks/usePlaceRoute';
import { distanceLabel } from '../../model/propertyCommute';
import RouteGuide from '../route-guide/RouteGuide';

import * as styles from './NeighborhoodPlacePanel.styles';

type Props = {
  place: NeighborhoodPlace;
  preview: Pick<NeighborhoodPreviewContext, 'destination' | 'maxMinutes' | 'maxTransfers'>;
  /** 휴대폰은 바로 전화를 걸고, 데스크탑은 전화 링크가 동작하지 않는 일이 많아 번호를 보여주고 복사하게 한다. */
  phoneAction: 'call' | 'copy';
};

const COPIED_NOTICE_MS = 2000;

/** 지도에서 고른 정류장, 부동산, 시설, 내 매물의 내용. 응답에 있는 필드를 빠짐없이 보인다. 휴대폰 시트와 데스크탑 지도 안 카드(`MapInfo`)가 함께 쓴다. */
/** 장소 자리에서 출퇴근 장소까지 직선거리 한 줄. 응답의 거리는 조회 칸 가운데 기준이라 쓰지 않고 출퇴근 장소 기준으로 다시 잰다. */
const fromDestination = (
  point: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number; name: string },
) => `${destination.name}에서 직선 ${distanceLabel(distanceMeters(destination, point))}`;

const PlaceDetails = ({ place, preview, phoneAction }: Props) => {
  const stopId =
    place.kind === 'busStop'
      ? transitStopIdForBusStop(place.busStop.nodeId)
      : place.kind === 'station'
        ? place.station.stopId
        : null;
  const busStopRoute = usePlaceRoute(preview, stopId);
  const stopLabel = place.kind === 'station' ? '출발 정류장' : '버스정류장';
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), COPIED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);
  if (place.kind === 'facility')
    return (
      <div className={styles.details}>
        <p className={styles.lead}>{getMapCategoryLabel(place.facility.category)}</p>
        <dl className={styles.facts}>
          <dt>주소</dt>
          <dd>{place.facility.address || '주소 정보가 없어요'}</dd>
          <dt>거리</dt>
          <dd>{fromDestination(place.facility, preview.destination)}</dd>
        </dl>
      </div>
    );
  if (place.kind !== 'agency')
    return (
      <div className={styles.details}>
        <p className={styles.lead}>
          {stopLabel} · 여기서 출발해 {preview.destination.name}까지 가는 경로예요.
        </p>
        {place.kind === 'busStop' && (
          <dl className={styles.facts}>
            <dt>거리</dt>
            <dd>{fromDestination(place.busStop, preview.destination)}</dd>
          </dl>
        )}
        <RouteGuide
          route={busStopRoute.route}
          isLoading={busStopRoute.isLoading}
          error={busStopRoute.error}
          onRetry={busStopRoute.retry}
        />
      </div>
    );
  const { phone, placeUrl, address } = place.agency;
  return (
    <div className={styles.details}>
      <p className={styles.lead}>공인중개사</p>
      <dl className={styles.facts}>
        <dt>주소</dt>
        <dd>{address || '주소 정보가 없어요'}</dd>
        <dt>거리</dt>
        <dd>{fromDestination(place.agency, preview.destination)}</dd>
      </dl>
      {phone || placeUrl ? (
        <div className={styles.actions}>
          {phone &&
            (phoneAction === 'call' ? (
              <a className={styles.primary} href={`tel:${phone}`}>
                전화 걸기 · {phone}
              </a>
            ) : (
              <div className={styles.phone}>
                <strong>{phone}</strong>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.clipboard) {
                      setCopyState('failed');
                      return;
                    }
                    navigator.clipboard.writeText(phone).then(
                      () => setCopyState('copied'),
                      () => setCopyState('failed'),
                    );
                  }}
                >
                  번호 복사
                </button>
                <span role="status">
                  {copyState === 'copied' ? '복사했어요' : copyState === 'failed' ? '복사하지 못했어요' : ''}
                </span>
              </div>
            ))}
          {placeUrl && (
            <a href={placeUrl} target="_blank" rel="noopener noreferrer">
              카카오맵에서 보기
            </a>
          )}
        </div>
      ) : (
        <p className={styles.empty}>등록된 연락처가 없어요.</p>
      )}
    </div>
  );
};

export default PlaceDetails;
