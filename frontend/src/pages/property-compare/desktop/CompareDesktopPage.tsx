import { css } from '@emotion/css';
import { useState } from 'react';

import { usePropertyList } from '@/features/property/api/useProperties';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import PropertyPlaceholderPhoto from '@/features/property/ui/property-placeholder-photo/PropertyPlaceholderPhoto';
import PropertyPrice from '@/features/property/ui/property-price/PropertyPrice';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';

import usePropertyComparison, { MAX_SELECTION } from '../hooks/usePropertyComparison';
import { DEFAULT_COMPARE_FILTERS, filterCompareProperties } from '../lib/compareFilters';
import CompareActionBar from '../ui/compare-action-bar/CompareActionBar';
import CompareEmpty from '../ui/compare-empty/CompareEmpty';
import CompareFilters from '../ui/compare-filters/CompareFilters';
import CompareLoadState from '../ui/compare-load-state/CompareLoadState';
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
    <main className={shared.page}>
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
              <div className={styles.body}>
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
                <aside id="compare-property-preview" className={styles.preview} aria-label="매물 미리 보기">
                  {preview ? (
                    <>
                      <div className={styles.photo}>
                        {preview.representativePhoto ? (
                          <AuthenticatedPhoto
                            propertyId={preview.propertyId}
                            photoId={preview.representativePhoto.photoId}
                            kind="thumbnail"
                            contentUrl={preview.representativePhoto.thumbnailUrl}
                            alt={`${preview.name} 대표 사진`}
                          />
                        ) : (
                          <PropertyPlaceholderPhoto />
                        )}
                      </div>
                      <h2>{preview.name}</h2>
                      <PropertyPrice
                        depositAmount={preview.depositAmount}
                        monthlyRentAmount={preview.monthlyRentAmount}
                        variant="plain"
                      />
                      <p>{preview.location.address || '주소 입력 전'}</p>
                      {preview.discoverySource.value && <p>발견 경로 {preview.discoverySource.value}</p>}
                    </>
                  ) : (
                    <p>매물의 상세 버튼을 누르면 사진, 주소, 가격을 볼 수 있어요.</p>
                  )}
                </aside>
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

    @media (min-width: 67rem) {
      grid-template-columns: minmax(0, 1fr) minmax(13rem, 24%);
    }
  `,
  preview: css`
    display: grid;
    gap: 0.45rem;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    overflow-wrap: anywhere;

    & h2,
    & p {
      margin: 0;
    }

    & h2 {
      font-size: 1rem;
    }

    & p {
      color: var(--color-muted);
      font-size: 0.75rem;
    }
  `,
  photo: css`
    display: grid;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: var(--radius-sm);

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
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
