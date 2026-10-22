import type { PointerEvent, RefObject } from 'react';

import type { PropertySummary } from '@/features/property/model/Property';

import type { MapPropertySheetStage } from '../../model/MapSheet';
import MapPropertyList from '../map-property-list/MapPropertyList';

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
}: MapPropertySheetProps) => {
  return (
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
            <MapPropertyList
              isLoading={isLoading}
              isError={isError}
              onRetry={onRetry}
              properties={properties}
              selectedPropertyId={selectedPropertyId}
              returnState={returnState}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default MapPropertySheet;
