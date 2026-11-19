import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { usePropertyList } from '@/features/property/api/useProperties';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';

import usePropertyComparison, { MAX_SELECTION } from '../hooks/usePropertyComparison';
import { DEFAULT_COMPARE_FILTERS, filterCompareProperties } from '../lib/compareFilters';
import CompareActionBar from '../ui/compare-action-bar/CompareActionBar';
import CompareEmpty from '../ui/compare-empty/CompareEmpty';
import CompareFilters from '../ui/compare-filters/CompareFilters';
import CompareLoadState from '../ui/compare-load-state/CompareLoadState';
import ComparePropertyPreview from '../ui/compare-property-preview/ComparePropertyPreview';
import CompareTable from '../ui/compare-table/CompareTable';

import * as shared from '../ComparePage.styles';

/**
 * 데스크탑 비교할 매물 선택. 화면 위 헤더는 공용 데스크탑 헤더가 대신하고,
 * 리스트 위 줄 오른쪽 필터로 좁힌 매물을 관리 화면 같은 표에서 1~5개 골라 PDF로 받는다.
 */
const CompareDesktopPage = () => {
  const properties = usePropertyList();
  const items = properties.data?.pages.flatMap((page) => page.content) ?? [];
  const { selectedIds, isExporting, hasExportError, toggle, downloadPdf } = usePropertyComparison();
  const hasProperties = items.length > 0;
  const [filters, setFilters] = useState(DEFAULT_COMPARE_FILTERS);
  const visibleItems = filterCompareProperties(items, filters);
  const [previewId, setPreviewId] = useState<number>();
  const preview = visibleItems.find((item) => item.propertyId === previewId);

  return (
    <main className={cx(shared.page, styles.wideMain)}>
      <h1 className="sr-only">비교할 매물 선택</h1>
      <CompareLoadState properties={properties}>
        {() => (
          <div className={shared.content}>
            <div className={styles.listHeader}>
              <div className={shared.selectionHeader} aria-live="polite">
                <strong>{selectedIds.length}개 선택</strong>
                <span>최대 {MAX_SELECTION}개</span>
              </div>
              {hasProperties && (
                <CompareFilters filters={filters} resultCount={visibleItems.length} onChange={setFilters} />
              )}
            </div>
            {hasProperties ? (
              <div className={cx(styles.body, styles.withPreviewSlot)}>
                <CompareTable
                  properties={visibleItems}
                  selectedIds={selectedIds}
                  maxSelection={MAX_SELECTION}
                  onToggle={(id) => {
                    setPreviewId(id);
                    toggle(id);
                  }}
                  previewId={preview?.propertyId}
                  onPreview={setPreviewId}
                />
                {preview && <ComparePropertyPreview property={preview} />}
              </div>
            ) : (
              <CompareEmpty />
            )}
            {hasExportError && (
              <InlineNotice tone="error">PDF를 만들지 못했어요. 잠시 후 다시 시도해 주세요.</InlineNotice>
            )}
            {hasProperties && (
              <CompareActionBar
                selectedCount={selectedIds.length}
                isExporting={isExporting}
                onDownload={() => void downloadPdf()}
              />
            )}
          </div>
        )}
      </CompareLoadState>
    </main>
  );
};

const styles = {
  body: css`
    display: grid;
    align-items: start;
    gap: 1rem;
  `,
  /*
   * 공용 데스크탑 셸은 화면 내용을 48rem 가운데 열에 가둔다. 상세 카드가 열리면 표가 찌그러지므로
   * 이 화면만 셸이 비워 둔 양옆 공간까지 넓히고, 상세가 닫혀 있을 때도 왼쪽에서 시작해 열릴 때 옆으로 밀리지 않게 한다.
   * 셸 규칙보다 우선하도록 선택자를 겹쳐 쓴다.
   */
  wideMain: css`
    label: CompareDesktopPage-wideMain;

    @media (min-width: 67rem) {
      &&&&&&&& {
        width: min(100%, 90rem);
        margin-right: auto;
        margin-left: 0;
      }
    }
  `,
  /*
   * 표 폭은 상세 카드 유무와 무관하게 고정하려고 오른쪽 20rem을 닫혀 있을 때도 비워 둔다.
   * 상세 카드는 그 자리에 고정 폭으로 따라다닌다. 좁은 창에서는 표만 가로로 민다.
   */
  withPreviewSlot: css`
    @media (min-width: 67rem) {
      grid-template-columns: minmax(0, 1fr) 20rem;

      & > aside {
        position: sticky;
        top: 1rem;
      }
    }
  `,
  /* 리스트 바로 위 줄: 왼쪽에 선택 개수, 오른쪽에 필터. */
  listHeader: css`
    label: CompareDesktopPage-listHeader;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 1rem;
  `,
};

export default CompareDesktopPage;
