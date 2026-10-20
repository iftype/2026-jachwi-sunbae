import { formatManwon } from '@/features/property/lib/propertyFormat';
import type { PropertySummary } from '@/features/property/model/Property';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import mascotImage from '@/shared/assets/jachwi-sunbae-goose.webp';
import SelectionControl from '@/shared/ui/selection-control/SelectionControl';

import { StageOverview } from '../compare-property-option/ComparePropertyOption';

import styles from './CompareTable.module.css';

type CompareTableProps = {
  properties: PropertySummary[];
  selectedIds: number[];
  maxSelection: number;
  onToggle: (propertyId: number) => void;
};

/**
 * 데스크탑 비교 표. 관리 화면 표처럼 회색 머리글 줄과 짝수 줄 줄무늬를 두고,
 * 한 줄에 체크·사진·매물 이름·보증금/월세·발견 경로·체크 진행을 나란히 놓는다.
 */
const CompareTable = ({ properties, selectedIds, maxSelection, onToggle }: CompareTableProps) => (
  <div className={styles.table}>
    {/* 각 칸 이름은 줄 안의 값으로도 읽히므로 화면 낭독기에서는 머리글 줄을 숨긴다. */}
    <div className={styles.header} aria-hidden="true">
      <span />
      <span />
      <span>매물</span>
      <span>보증금 / 월세</span>
      <span>발견 경로</span>
      <span>체크 진행</span>
    </div>
    <ul className={styles.rows} aria-label="비교할 매물 목록">
      {properties.length === 0 && <li className={styles.noResult}>조건에 맞는 매물이 없어요.</li>}
      {properties.map((property) => {
        const isSelected = selectedIds.includes(property.propertyId);
        return (
          <li key={property.propertyId}>
            <SelectionControl
              className={styles.row}
              checked={isSelected}
              disabled={!isSelected && selectedIds.length >= maxSelection}
              onSelect={() => onToggle(property.propertyId)}
              markClassName={styles.checkmark}
            >
              <span className={styles.thumbnail}>
                {property.representativePhoto === null ? (
                  <img src={mascotImage} alt="" />
                ) : (
                  <AuthenticatedPhoto
                    propertyId={property.propertyId}
                    photoId={property.representativePhoto.photoId}
                    contentUrl={property.representativePhoto.contentUrl}
                    alt=""
                  />
                )}
              </span>
              <strong className={styles.cell}>{property.name}</strong>
              <span className={styles.cell}>
                {formatManwon(property.depositAmount)} / {formatManwon(property.monthlyRentAmount)}
              </span>
              <span className={styles.cell}>{property.discoverySource.value || '—'}</span>
              <StageOverview property={property} />
            </SelectionControl>
          </li>
        );
      })}
    </ul>
  </div>
);

export default CompareTable;
