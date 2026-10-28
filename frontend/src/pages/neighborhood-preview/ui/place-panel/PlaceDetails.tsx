import { useEffect, useState } from 'react';

import { transitStopIdForBusStop } from '@/features/map/lib/transitStop';

import type { NeighborhoodPlace } from '../../hooks/useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import usePlaceRoute from '../../hooks/usePlaceRoute';
import RouteGuide from '../route-guide/RouteGuide';

import styles from './NeighborhoodPlacePanel.module.css';

type Props = {
  place: NeighborhoodPlace;
  preview: Pick<NeighborhoodPreviewContext, 'destination' | 'maxMinutes' | 'maxTransfers'>;
  /** 휴대폰은 바로 전화를 걸고, 데스크탑은 전화 링크가 동작하지 않는 일이 많아 번호를 보여주고 복사하게 한다. */
  phoneAction: 'call' | 'copy';
  /** 휴대폰 바텀시트는 정류장 경로를 요약만 보여주고, 이 동작으로 전체 화면 경로를 연다. 없으면 경로 전체를 바로 보여준다. */
  onOpenRoute?: () => void;
};

const COPIED_NOTICE_MS = 2000;

/** 지도에서 고른 정류장·부동산의 내용. 데스크탑 옆 칸(NeighborhoodPlacePanel)과 휴대폰 바텀시트(NeighborhoodPlaceSheet)가 함께 쓴다. */
const PlaceDetails = ({ place, preview, phoneAction, onOpenRoute }: Props) => {
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
  if (place.kind !== 'agency' && onOpenRoute)
    return (
      <div className={styles.details}>
        <p className={styles.lead}>
          {stopLabel} · {preview.destination.name}까지
        </p>
        <p className={styles.summary} role="status">
          {busStopRoute.isLoading
            ? '경로를 찾고 있어요.'
            : busStopRoute.route
              ? `예상 ${busStopRoute.route.totalMinutes}분 · 환승 ${busStopRoute.route.transferCount}회`
              : (busStopRoute.error ?? '')}
        </p>
        <button type="button" className={styles.primary} disabled={!busStopRoute.route} onClick={onOpenRoute}>
          경로 자세히 보기
        </button>
      </div>
    );
  if (place.kind !== 'agency')
    return (
      <div className={styles.details}>
        <p className={styles.lead}>
          {stopLabel} · 여기서 출발해 {preview.destination.name}까지 가는 경로예요.
        </p>
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
      <p className={styles.lead}>공인중개사{address ? ` · ${address}` : ''}</p>
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
