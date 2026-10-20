import { useState } from 'react';

import { usePropertyList } from '@/features/property/api/useProperties';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';

import usePropertyComparison, { MAX_SELECTION, MIN_SELECTION } from '../hooks/usePropertyComparison';
import { DEFAULT_COMPARE_FILTERS, filterCompareProperties } from '../lib/compareFilters';
import CompareActionBar from '../ui/compare-action-bar/CompareActionBar';
import CompareEmpty from '../ui/compare-empty/CompareEmpty';
import CompareFilters from '../ui/compare-filters/CompareFilters';
import CompareLoadState from '../ui/compare-load-state/CompareLoadState';
import CompareTable from '../ui/compare-table/CompareTable';

import shared from '../ComparePage.module.css';
import styles from './CompareDesktopPage.module.css';

/**
 * 데스크탑 비교할 매물 선택. 화면 위 헤더는 공용 데스크탑 헤더가 대신하고,
 * 리스트 위 줄 오른쪽 필터로 좁힌 매물을 관리 화면 같은 표에서 2~5개 골라 PDF로 받는다.
 */
const CompareDesktopPage = () => {
  const properties = usePropertyList();
  const items = properties.data?.pages.flatMap((page) => page.content) ?? [];
  const { selectedIds, isExporting, hasExportError, toggle, downloadPdf } = usePropertyComparison();
  const hasEnoughProperties = items.length >= MIN_SELECTION;
  const [filters, setFilters] = useState(DEFAULT_COMPARE_FILTERS);
  const visibleItems = filterCompareProperties(items, filters);

  return (
    <main className={shared.page}>
      <h1 className="sr-only">비교할 매물 선택</h1>
      <CompareLoadState properties={properties} />
      {properties.isSuccess && (
        <div className={shared.content}>
          <div className={styles.listHeader}>
            <div className={shared.selectionHeader} aria-live="polite">
              <strong>{selectedIds.length}개 선택</strong>
              <span>최대 {MAX_SELECTION}개</span>
            </div>
            {hasEnoughProperties && (
              <CompareFilters filters={filters} resultCount={visibleItems.length} onChange={setFilters} />
            )}
          </div>
          {hasEnoughProperties ? (
            <CompareTable
              properties={visibleItems}
              selectedIds={selectedIds}
              maxSelection={MAX_SELECTION}
              onToggle={toggle}
            />
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

export default CompareDesktopPage;
