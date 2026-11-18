import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { usePropertyList } from '@/features/property/api/useProperties';
import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import usePropertyComparison, { MAX_SELECTION } from '../hooks/usePropertyComparison';
import { DEFAULT_COMPARE_FILTERS, filterCompareProperties } from '../lib/compareFilters';
import CompareActionBar from '../ui/compare-action-bar/CompareActionBar';
import CompareEmpty from '../ui/compare-empty/CompareEmpty';
import CompareFilters from '../ui/compare-filters/CompareFilters';
import CompareLoadState from '../ui/compare-load-state/CompareLoadState';
import ComparePropertyOption from '../ui/compare-property-option/ComparePropertyOption';

import * as shared from '../ComparePage.styles';

/** 휴대폰·태블릿 비교할 매물 선택. 이어진 리스트에서 1~5개를 골라 PDF로 받는다. */
const CompareMobilePage = () => {
  const properties = usePropertyList();
  const items = properties.data?.pages.flatMap((page) => page.content) ?? [];
  const { selectedIds, isExporting, hasExportError, toggle, downloadPdf } = usePropertyComparison();
  const hasProperties = items.length > 0;
  // 데스크탑과 같은 필터로 목록을 좁힌다.
  const [filters, setFilters] = useState(DEFAULT_COMPARE_FILTERS);
  const visibleItems = filterCompareProperties(items, filters);

  return (
    <main className={shared.page}>
      <TopNavigation title="비교할 매물 선택" backTo={HOME_PATH} />
      <CompareLoadState properties={properties}>
        {() => (
          <div className={cx(shared.content, styles.content)}>
            <div className={shared.selectionHeader} aria-live="polite">
              <strong>{selectedIds.length}개 선택</strong>
              <span>최대 {MAX_SELECTION}개</span>
            </div>
            {hasProperties && (
              <CompareFilters filters={filters} resultCount={visibleItems.length} onChange={setFilters} />
            )}
            {hasProperties ? (
              <ul className={styles.propertyList} aria-label="비교할 매물 목록">
                {visibleItems.map((property) => {
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
  content: css`
    padding-top: 0.8rem;
    & > div[aria-live] {
      font-size: 0.86rem;
    }
    & > div[aria-live] strong {
      font-size: 1rem;
    }
  `,
  /* 매물은 따로 떨어진 카드 대신 한 상자 안에 이어진 리스트로 두고, 항목 사이는 얇은 줄로 나눈다. */
  propertyList: css`
    label: CompareMobilePage-propertyList;
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    list-style: none;

    & > li + li {
      border-top: 1px solid #e4e6ea;
    }
  `,
};

export default CompareMobilePage;
