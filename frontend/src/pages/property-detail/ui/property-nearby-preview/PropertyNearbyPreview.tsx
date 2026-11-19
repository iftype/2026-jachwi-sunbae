import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useNearbyFacilities } from '@/features/map/api/useNearbyFacilities';
import { coordinatesAreClose, type MapCoordinate, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import { FACILITY_CATEGORY_COLOR, type FacilityCategory, isFacilityCategory } from '@/features/map/lib/mapPresentation';
import { summarizeNearby } from '@/features/map/lib/nearbySummary';
import type { MapAddress, MapMarker } from '@/features/map/model/Map';
import type { MapRadiusCircle } from '@/features/map/model/MapCanvas';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCurrentLocationButton from '@/features/map/ui/map-current-location-button/MapCurrentLocationButton';
import MapZoomControl from '@/features/map/ui/map-zoom-control/MapZoomControl';

import { PROPERTY_PIN_IMAGE } from './nearbyColors';
import NearbyRing from './NearbyRing';
import useLocationPick, { pickedAddressText } from './useLocationPick';

type PropertyNearbyPreviewProps = {
  propertyId: number;
  latitude: number;
  longitude: number;
  /** 주소 바꾸기를 눌렀으면 매물 핀을 지우고, 이 지도를 눌러 새 위치를 고른다. */
  isEditingLocation?: boolean;
  /** false면 지도 없이 고리 요약만 둔다. 옆에 큰 지도가 보이는 데스크탑이 쓴다. */
  showMap?: boolean;
  onSaveLocation?: (address: MapAddress) => Promise<void>;
  onEndEditLocation?: () => void;
};

/** 요약 반경. 걸어서 5~7분 거리로 하나만 정한다. */
const RADIUS = 500;
/** 작은 지도 칸에서 500m 원이 다 보이는 확대 단계. */
const PREVIEW_LEVEL = 7;

/** 매물 상세 기본 정보 아래에 두는 작은 주변 지도와 고리 요약. 500m 안 시설을 색 점으로 모두 띄운다. */
const PropertyNearbyPreview = ({
  propertyId,
  latitude,
  longitude,
  isEditingLocation = false,
  showMap = true,
  onSaveLocation,
  onEndEditLocation,
}: PropertyNearbyPreviewProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const center = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  const [level, setLevel] = useState(PREVIEW_LEVEL);
  /** 지도가 보고 있는 가운데. 반경 원은 늘 매물 자리에 두고, 이것만 끌거나 현재 위치로 옮긴다. */
  const [viewCenter, setViewCenter] = useState<MapCoordinate>(center);
  const [myLocation, setMyLocation] = useState<MapCoordinate | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  useEffect(() => setViewCenter(center), [center]);

  const moveToMyLocation = async () => {
    setIsLocating(true);
    try {
      const coordinate = await requestCurrentMapLocation();
      setMyLocation(coordinate);
      setViewCenter(coordinate);
    } catch {
      // 권한이 없거나 위치를 못 찾으면 지도를 그대로 둔다.
    } finally {
      setIsLocating(false);
    }
  };
  /** 범례에서 고른 시설. 고르면 지도에 그 시설 점만 남긴다. */
  const [focused, setFocused] = useState<FacilityCategory | null>(null);
  const location = useLocationPick(isEditingLocation, onSaveLocation, onEndEditLocation);
  const nearby = useNearbyFacilities(center, RADIUS, [], true, { loadAllCategories: true });

  useEffect(() => {
    // scrollIntoView가 없는 환경(jsdom 등)에서도 터지지 않게 있을 때만 부른다.
    if (isEditingLocation) sectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [isEditingLocation]);

  const places = nearby.data?.places;
  const markers = useMemo<MapMarker[]>(() => {
    const dots: MapMarker[] = (places ?? [])
      .filter((place) => isFacilityCategory(place.category))
      .filter((place) => focused === null || place.category === focused)
      .flatMap((place) =>
        isFacilityCategory(place.category) ? [{ place, color: FACILITY_CATEGORY_COLOR[place.category] }] : [],
      )
      .map(({ place, color }) => ({
        id: `nearby-${place.category}-${place.providerPlaceId}`,
        latitude: place.latitude,
        longitude: place.longitude,
        label: place.name,
        tone: 'dot',
        color,
      }));
    // 위치를 바꾸는 동안에는 지금 매물 핀을 지우고, 새로 고른 자리에만 핀을 둔다.
    const pin = isEditingLocation
      ? location.picked && {
          id: 'picked-location',
          latitude: location.picked.address.latitude,
          longitude: location.picked.address.longitude,
          label: '새 위치',
        }
      : { id: `property-${propertyId}`, ...center, label: '이 매물' };
    // 매물은 글자 없는 기본 파란 핀으로 그려 작은 점들 사이에서 잘 보이게 한다.
    const withMe: MapMarker[] = myLocation
      ? [...dots, { id: 'my-location', ...myLocation, label: '내 위치', tone: 'current' }]
      : dots;
    return pin ? [...withMe, { ...pin, tone: 'selected', image: PROPERTY_PIN_IMAGE }] : withMe;
  }, [places, focused, isEditingLocation, location.picked, center, propertyId, myLocation]);
  const circles = useMemo<MapRadiusCircle[]>(() => [{ radiusMeters: RADIUS, label: '500m' }], []);
  const summary = useMemo(
    () => (nearby.isSuccess ? summarizeNearby(nearby.data.places, nearby.data.counts) : []),
    [nearby.isSuccess, nearby.data],
  );
  const hasAny = summary.some((item) => item.count > 0);
  const { picked } = location;
  /** 고른 시설과 확대 단계를 처음으로 되돌린다. */
  const reset = () => {
    setFocused(null);
    setLevel(PREVIEW_LEVEL);
    setViewCenter(center);
  };

  return (
    <div ref={sectionRef} className={styles.content} aria-label="매물 주변 환경">
      {showMap && (
        <div className={styles.map}>
          <MapCanvas
            center={viewCenter}
            onCenterChange={(latitude, longitude) => setViewCenter({ latitude, longitude })}
            markers={markers}
            circles={circles}
            radiusCenter={center}
            level={level}
            onLevelChange={setLevel}
            onSelectLocation={isEditingLocation ? (lat, lng) => void location.pick(lat, lng) : undefined}
            hideLoading
          />
          {/* 휴대폰에서 지도를 쓸어도 페이지가 스크롤되게 덮어 둔다. 확대는 버튼으로 한다. 위치를 바꿀 때는 걷어 낸다. */}
          {!isEditingLocation && <div className={styles.mapCover} aria-hidden="true" />}
          <div className={styles.controls}>
            <MapZoomControl level={level} onChange={setLevel} />
            <MapCurrentLocationButton isLocating={isLocating} onClick={() => void moveToMyLocation()} />
          </div>
          {(focused !== null || level !== PREVIEW_LEVEL || !coordinatesAreClose(viewCenter, center, 0.0005)) && (
            <button className={styles.reset} type="button" onClick={reset}>
              초기화
            </button>
          )}
          {isEditingLocation && (
            <div className={styles.toast} role="status">
              <span>
                {picked === null
                  ? '지도를 눌러 새 위치를 고르세요.'
                  : picked.status === 'geocoding'
                    ? '주소를 찾는 중이에요…'
                    : picked.status === 'error'
                      ? '이 자리의 주소를 찾지 못했어요. 다른 곳을 눌러 주세요.'
                      : location.saveFailed
                        ? '저장하지 못했어요. 다시 눌러 주세요.'
                        : pickedAddressText(picked.address)}
              </span>
              <div className={styles.toastActions}>
                <button type="button" onClick={onEndEditLocation} disabled={location.isSaving}>
                  취소
                </button>
                {picked?.status === 'ready' && (
                  <button
                    type="button"
                    data-primary="true"
                    onClick={() => void location.save()}
                    disabled={location.isSaving}
                  >
                    {location.isSaving ? '변경 중…' : '이 위치로 변경'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {nearby.isError ? (
        <div className={styles.card}>
          <span className={styles.error} role="alert">
            주변 정보를 불러오지 못했어요.
          </span>
          <button className={styles.retry} type="button" onClick={() => void nearby.refetch()}>
            다시 시도
          </button>
        </div>
      ) : (
        <div className={styles.card}>
          {nearby.isPending ? (
            <span className={styles.muted} role="status">
              주변을 살펴보는 중이에요…
            </span>
          ) : !hasAny ? (
            <span className={styles.muted}>500m 안에서 찾은 시설이 없어요.</span>
          ) : (
            <NearbyRing
              summary={summary}
              focused={focused}
              onFocus={(category) => setFocused((current) => (current === category ? null : category))}
            />
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  content: css`
    label: PropertyNearbyPreview-content;
    display: grid;
    gap: 0.5rem;
  `,

  /* 고른 시설이나 확대를 바꿨을 때만 지도 왼쪽 위에 띄운다. */
  reset: css`
    label: PropertyNearbyPreview-reset;
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 31;
    min-height: 2rem;
    padding: 0 0.75rem;
    border: 0;
    border-radius: 999px;
    background: rgb(255 255 255 / 96%);
    box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
    color: var(--color-brand-blue-ink);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  `,

  map: css`
    label: PropertyNearbyPreview-map;
    position: relative;

    /* 휴대폰은 섹션 좌우 여백의 절반만큼 지도를 바깥으로 넓힌다. */
    @media (max-width: 1023px) {
      margin-inline: calc(var(--page-inline-padding, 1rem) * -0.5);
    }
    height: 13rem;
    overflow: hidden;
    border-radius: 0;

    & > div:first-of-type {
      min-height: 0;
    }
  `,

  /* 손가락으로 쓰는 기기에서만 덮는다. 마우스(PC)는 지도를 끌고 휠로 확대할 수 있다. */
  mapCover: css`
    label: PropertyNearbyPreview-mapCover;
    position: absolute;
    inset: 0;
    z-index: 30;

    @media (pointer: fine) {
      display: none;
    }
  `,

  controls: css`
    label: PropertyNearbyPreview-controls;
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 31;
    display: grid;
    justify-items: end;
    gap: 0.4rem;
  `,

  /* 지도 아래쪽에 띄우는 위치 변경 안내. 본 방 기록 토스트처럼 흰 바탕에 그림자를 둔다. */
  toast: css`
    label: PropertyNearbyPreview-toast;
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    left: 0.5rem;
    z-index: 32;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.55rem 0.6rem 0.55rem 0.85rem;
    border-radius: 0.9rem;
    background: rgb(255 255 255 / 96%);
    box-shadow: 0 3px 16px rgb(0 0 0 / 12%);
    color: var(--color-brand-blue-ink);
    font-size: 0.8rem;
    font-weight: 600;

    & > span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,

  toastActions: css`
    label: PropertyNearbyPreview-toastActions;
    display: flex;
    flex: none;
    gap: 0.3rem;

    & button {
      min-height: 2rem;
      padding: 0 0.7rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: var(--color-surface-muted);
      color: var(--color-ink-soft);
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }

    & button[data-primary='true'] {
      background: var(--color-brand-blue-ink);
      color: #fff;
    }

    & button:disabled {
      cursor: default;
      opacity: 0.5;
    }
  `,

  card: css`
    label: PropertyNearbyPreview-card;
    display: grid;
    gap: 0.4rem;
    padding: 0.25rem 0;
  `,

  muted: css`
    label: PropertyNearbyPreview-muted;
    color: var(--color-text-muted, #6b7280);
    font-size: 0.8rem;
  `,

  retry: css`
    label: PropertyNearbyPreview-retry;
    justify-self: start;
    padding: 0.3rem 0.8rem;
    border: 1px solid #6b9ae6;
    border-radius: 999px;
    background: var(--color-surface);
    color: #3f6fc4;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  `,

  error: css`
    label: PropertyNearbyPreview-error;
    color: var(--color-error);
    font-size: 0.8rem;
  `,
};

export default PropertyNearbyPreview;
