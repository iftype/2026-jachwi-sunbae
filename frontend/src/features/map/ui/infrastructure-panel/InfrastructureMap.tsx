import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import Icon from '@/shared/ui/icon/Icon';

import useInfrastructureLayer, { INFRASTRUCTURE_CATEGORIES } from '../../hooks/useInfrastructureLayer';
import {
  DESKTOP_FACILITY_MARKER_LEVEL,
  FACILITY_MARKER_LEVEL,
  facilityFocusLevel,
} from '../../lib/mapFacilityVisibility';
import type { MapBounds } from '../../model/Map';
import type { MapCanvasProps } from '../../model/MapCanvas';
import MapCanvasSurface from '../map-canvas/MapCanvasSurface';
import MapCategoryRail from '../map-category-rail/MapCategoryRail';

type Props = { mapProps: MapCanvasProps; open: boolean; onClose: () => void };
const sameBounds = (left: MapBounds | null, right: MapBounds) =>
  left?.south === right.south && left?.north === right.north && left?.east === right.east && left?.west === right.west;

const InfrastructureMap = ({ mapProps, open }: Props) => {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [observedLevel, setObservedLevel] = useState(mapProps.level ?? 8);
  useEffect(() => setObservedLevel(mapProps.level ?? 8), [mapProps.level]);
  const center = useRef(mapProps.center);
  const isDesktop = useIsDesktop();
  const markerLevel = isDesktop ? DESKTOP_FACILITY_MARKER_LEVEL : FACILITY_MARKER_LEVEL;
  const layer = useInfrastructureLayer(open, bounds, observedLevel, markerLevel);
  return (
    <>
      <MapCanvasSurface
        {...mapProps}
        markers={[...(mapProps.markers ?? []), ...layer.markers]}
        selectedMarkerId={open && layer.selected ? layer.selected.id : mapProps.selectedMarkerId}
        onCenterChange={(latitude, longitude) => {
          center.current = { latitude, longitude };
          mapProps.onCenterChange?.(latitude, longitude);
        }}
        onBoundsChange={(next) => {
          setBounds((previous) => (sameBounds(previous, next) ? previous : next));
          mapProps.onBoundsChange?.(next);
        }}
        onLevelChange={(next) => {
          setObservedLevel(next);
          mapProps.onLevelChange?.(next);
        }}
        onSelectMarker={(marker) => {
          if (open && layer.selectMarker(marker)) return;
          layer.clearSelection();
          mapProps.onSelectMarker?.(marker);
        }}
      />
      {open && (
        <>
          <MapCategoryRail
            className={styles.rail}
            showIcons={false}
            selectedCategories={layer.category ? [layer.category] : []}
            order={[...INFRASTRUCTURE_CATEGORIES]}
            labels={{ AGENCY: '중개사' }}
            onToggle={(category) => {
              if (
                category === 'AGENCY' ||
                category === 'HOSPITAL' ||
                category === 'TRANSPORT' ||
                category === 'CONVENIENCE'
              ) {
                layer.selectCategory(category);
                if (!layer.isClose) {
                  mapProps.onCenterChange?.(center.current.latitude, center.current.longitude);
                  mapProps.onLevelChange?.(facilityFocusLevel(markerLevel));
                  setObservedLevel(facilityFocusLevel(markerLevel));
                }
              }
            }}
          />
          {!layer.isClose && <p className={styles.hint}>확대하면 주변 시설이 보여요</p>}
          {layer.isError && (
            <div className={styles.hint} role="alert">
              시설 정보를 불러오지 못했어요.{' '}
              <button type="button" onClick={() => void layer.retry()}>
                다시 시도
              </button>
            </div>
          )}
          {layer.selected && (
            <aside className={styles.info} aria-label="시설 정보 카드">
              <header>
                <h2>{layer.selected.name}</h2>
                <button type="button" aria-label="시설 정보 닫기" onClick={layer.clearSelection}>
                  <Icon name="close" size={20} />
                </button>
              </header>
              <p>{layer.selected.address || '지도에서 위치를 확인해 주세요.'}</p>
              {layer.selected.phone && <a href={`tel:${layer.selected.phone}`}>{layer.selected.phone}</a>}
            </aside>
          )}
        </>
      )}
    </>
  );
};
const styles = {
  rail: css`
    label: InfrastructureMap-rail;
    && {
      top: 10.5rem;
      right: 1.15rem;
      z-index: 35;
    }
    [data-desktop='false'] && {
      top: calc(max(0.85rem, env(safe-area-inset-top)) + 13.75rem);
      right: 0.95rem;
    }
  `,
  hint: css`
    label: InfrastructureMap-hint;
    position: absolute;
    z-index: 35;
    bottom: 5rem;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    margin: 0;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: white;
    font-size: 0.8rem;
  `,
  info: css`
    label: InfrastructureMap-info;
    position: absolute;
    z-index: 45;
    bottom: 1.25rem;
    right: 5rem;
    width: min(20rem, calc(100% - 2rem));
    max-height: calc(100% - 6rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    background: white;
    box-shadow: var(--shadow-floating);
    & > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    & h2 {
      margin: 0;
      font-size: 1rem;
    }
    & button {
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      cursor: pointer;
    }
    & p {
      font-size: 0.85rem;
      color: var(--color-muted);
      line-height: 1.5;
    }
    [data-desktop='false'] & {
      bottom: 9rem;
      right: 1rem;
      max-height: 45%;
    }
  `,
};
export default InfrastructureMap;
