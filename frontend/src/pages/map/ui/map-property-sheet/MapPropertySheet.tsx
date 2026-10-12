import type { PointerEvent, RefObject } from 'react';

import type { PropertySummary } from '@/features/property/model/Property';
import PropertyCard from '@/features/property/ui/property-card/PropertyCard';

import type { MapPropertySheetStage } from '../../model/MapSheet';

import styles from './MapPropertySheet.module.css';

type MapPropertySheetProps = {
  sheetRef: RefObject<HTMLElement | null>;
  stage: MapPropertySheetStage;
  isDragging: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  properties: PropertySummary[];
  selectedPropertyId: number | null;
  onDragStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onToggle: () => void;
  returnState?: unknown;
};

const MapPropertySheet = ({
  sheetRef,
  stage,
  isDragging,
  isLoading,
  isError,
  onRetry,
  properties,
  selectedPropertyId,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onToggle,
  returnState,
}: MapPropertySheetProps) => (
  <div className={styles.sheetViewport} data-sheet-viewport>
    <section
      ref={sheetRef}
      className={`${styles.sheet} ${stage === 'closed' ? styles.collapsed : ''}`}
      data-dragging={isDragging || undefined}
      data-single={selectedPropertyId !== null || undefined}
      aria-label="지도 주변 매물 목록"
    >
      <button
        type="button"
        className={styles.header}
        aria-expanded={stage !== 'closed' || isDragging}
        aria-label={stage === 'closed' ? '지도 위 매물 목록 열기' : '지도 위 매물 목록 닫기'}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragCancel}
        onClick={onToggle}
      >
        <div className={styles.grabber}>
          <span className={styles.handle} />
        </div>
      </button>

      <div className={styles.contentViewport}>
        <div
          className={styles.body}
          data-sheet-content
          aria-hidden={stage === 'closed' && !isDragging}
          inert={stage === 'closed' && !isDragging}
        >
          {isLoading ? (
            <div className={styles.empty} role="status">
              매물을 불러오는 중이에요.
            </div>
          ) : isError ? (
            <div className={styles.empty} role="alert">
              매물을 불러오지 못했어요.{' '}
              <button type="button" onClick={onRetry}>
                다시 시도
              </button>
            </div>
          ) : properties.length === 0 ? (
            <div className={styles.empty}>현재 지도 화면에 등록된 매물이 없어요.</div>
          ) : (
            <ul className={styles.list}>
              {properties.map((property) => (
                <li key={property.propertyId} data-selected={property.propertyId === selectedPropertyId || undefined}>
                  <PropertyCard property={property} returnTo="/map" returnState={returnState} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  </div>
);

export default MapPropertySheet;
