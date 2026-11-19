import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMapCategoryLabel } from '@/features/map/lib/mapPresentation';
import { distanceMeters } from '@/features/map/lib/mapViewportQuery';
import { transitStopIdForBusStop } from '@/features/map/lib/transitStop';
import { formatRentSummary } from '@/features/property/lib/propertyFormat';
import { propertyDetailPath } from '@/shared/lib/navigation/appPaths';

import type { NeighborhoodPlace } from '../../hooks/useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import usePlaceRoute from '../../hooks/usePlaceRoute';
import usePropertyRoute from '../../hooks/usePropertyRoute';
import { distanceLabel, propertyCommuteLabel } from '../../model/propertyCommute';
import RouteGuide from '../route-guide/RouteGuide';

import * as styles from './NeighborhoodPlacePanel.styles';

type Props = {
  place: NeighborhoodPlace;
  preview: Pick<NeighborhoodPreviewContext, 'destination' | 'maxMinutes' | 'maxTransfers'>;
  /** 휴대폰은 바로 전화를 걸고, 데스크탑은 전화 링크가 동작하지 않는 일이 많아 번호를 보여주고 복사하게 한다. */
  phoneAction: 'call' | 'copy';
  /** `My` 매물의 통근 시간 상한(분). 서버가 정한 값이다. */
  commuteMaxMinutes?: number;
};

const COPIED_NOTICE_MS = 2000;

/** 지도에서 고른 정류장, 부동산, 시설, 내 매물의 내용. 응답에 있는 필드를 빠짐없이 보인다. 휴대폰 시트와 데스크탑 지도 안 카드(`MapInfo`)가 함께 쓴다. */
/** 장소 자리에서 출퇴근 장소까지 직선거리 한 줄. 응답의 거리는 조회 칸 가운데 기준이라 쓰지 않고 출퇴근 장소 기준으로 다시 잰다. */
const fromDestination = (
  point: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number; name: string },
) => `${destination.name}에서 직선 ${distanceLabel(distanceMeters(destination, point))}`;

const PlaceDetails = ({ place, preview, phoneAction, commuteMaxMinutes = 60 }: Props) => {
  const stopId =
    place.kind === 'busStop'
      ? transitStopIdForBusStop(place.busStop.nodeId)
      : place.kind === 'station'
        ? place.station.stopId
        : null;
  const busStopRoute = usePlaceRoute(preview, stopId);
  // 통근 시간이 나온 내 매물만 동선을 부른다. 위치가 없거나 너무 먼 매물은 부르지 않는다.
  const reachablePropertyId =
    place.kind === 'property' && place.property.commute?.status === 'REACHABLE' ? place.property.propertyId : null;
  const propertyRoute = usePropertyRoute(preview, reachablePropertyId);
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
  if (place.kind === 'property') {
    const { property } = place;
    return (
      <div className={`${styles.details} ${styles.fill}`}>
        <p className={styles.lead}>내 매물</p>
        <dl className={styles.facts}>
          <dt>보증금/월세</dt>
          <dd>{formatRentSummary(property.depositAmount, property.monthlyRentAmount)}</dd>
          <dt>주소</dt>
          <dd>{property.address || '주소 정보가 없어요'}</dd>
          <dt>통근</dt>
          <dd>
            {property.commute ? (
              <>
                {preview.destination.name}까지 <b>{propertyCommuteLabel(property.commute, commuteMaxMinutes)}</b>
              </>
            ) : (
              '통근 시간을 불러오고 있어요'
            )}
          </dd>
        </dl>
        {reachablePropertyId !== null && (
          <RouteGuide
            route={propertyRoute.route}
            isLoading={propertyRoute.isLoading}
            error={propertyRoute.error}
            onRetry={propertyRoute.retry}
          />
        )}
        <div className={styles.actions}>
          <Link className={styles.primary} to={propertyDetailPath(property.propertyId)}>
            매물 상세 보기
          </Link>
        </div>
      </div>
    );
  }
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
