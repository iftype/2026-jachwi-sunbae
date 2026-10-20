import { usePropertyList } from '@/features/property/api/useProperties';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import usePropertyComparison, { MAX_SELECTION, MIN_SELECTION } from '../hooks/usePropertyComparison';
import CompareActionBar from '../ui/compare-action-bar/CompareActionBar';
import CompareEmpty from '../ui/compare-empty/CompareEmpty';
import CompareLoadState from '../ui/compare-load-state/CompareLoadState';
import ComparePropertyOption from '../ui/compare-property-option/ComparePropertyOption';

import shared from '../ComparePage.module.css';
import styles from './CompareMobilePage.module.css';

/** 휴대폰·태블릿 비교할 매물 선택. 이어진 리스트에서 2~5개를 골라 PDF로 받는다. */
const CompareMobilePage = () => {
  const properties = usePropertyList();
  const items = properties.data?.pages.flatMap((page) => page.content) ?? [];
  const { selectedIds, isExporting, hasExportError, toggle, downloadPdf } = usePropertyComparison();
  const hasEnoughProperties = items.length >= MIN_SELECTION;

  return (
    <main className={shared.page}>
      <TopNavigation title="비교할 매물 선택" backTo="/" />
      <CompareLoadState properties={properties} />
      {properties.isSuccess && (
        <div className={shared.content}>
          <div className={shared.selectionHeader} aria-live="polite">
            <strong>{selectedIds.length}개 선택</strong>
            <span>최대 {MAX_SELECTION}개</span>
          </div>
          {hasEnoughProperties ? (
            <ul className={styles.propertyList} aria-label="비교할 매물 목록">
              {items.map((property) => {
                const isSelected = selectedIds.includes(property.propertyId);
                return (
                  <li key={property.propertyId}>
                    <ComparePropertyOption
                      property={property}
                      isSelected={isSelected}
                      isDisabled={!isSelected && selectedIds.length >= MAX_SELECTION}
                      onToggle={() => toggle(property.propertyId)}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <CompareEmpty />
          )}
          {hasExportError && (
            <InlineNotice tone="error">PDF를 만들지 못했어요. 잠시 후 다시 시도해 주세요.</InlineNotice>
          )}
          {hasEnoughProperties && (
            <CompareActionBar
              selectedCount={selectedIds.length}
              isExporting={isExporting}
              onDownload={() => void downloadPdf()}
            />
          )}
        </div>
      )}
    </main>
  );
};

export default CompareMobilePage;
