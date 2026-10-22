import type { PropertySummary } from '@/features/property/model/Property';
import PropertyCard from '@/features/property/ui/property-card/PropertyCard';

import styles from './MapPropertyList.module.css';

type MapPropertyListProps = {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  properties: PropertySummary[];
  selectedPropertyId: number | null;
  returnState?: unknown;
};

/** 지도 화면 안 매물 목록 내용. 휴대폰 바텀시트와 데스크탑 왼쪽 목록이 함께 쓴다. */
const MapPropertyList = ({
  isLoading,
  isError,
  onRetry,
  properties,
  selectedPropertyId,
  returnState,
}: MapPropertyListProps) =>
  isLoading ? (
    <div className={styles.loading} role="status">
      <span className={styles.visuallyHidden}>매물을 불러오는 중이에요.</span>
      {/* 불러오는 동안 매물 줄 자리를 스켈레톤으로 보여 준다. */}
      {[0, 1, 2].map((index) => (
        <span key={index} className={styles.skeletonRow} aria-hidden="true">
          <span className={styles.skeleton} />
          <span className={styles.skeletonLines}>
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
          </span>
        </span>
      ))}
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
          <PropertyCard
            property={property}
            returnTo="/map"
            returnState={returnState}
            to={`/map/${property.propertyId}`}
          />
        </li>
      ))}
    </ul>
  );

export default MapPropertyList;
