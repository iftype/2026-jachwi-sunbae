import { css } from '@emotion/css';
import { useEffect, useId, useRef } from 'react';

import AddressSearchResults, { handleSearchKeys } from '@/features/map/ui/address-search-results/AddressSearchResults';
import useExclusiveDropdown from '@/shared/lib/hooks/useExclusiveDropdown';
import SearchField from '@/shared/ui/search-field/SearchField';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import FinderSearchTip from '../finder-search-tip/FinderSearchTip';

/** 입력을 멈추고 이만큼 지나면 검색한다. */
const SEARCH_DEBOUNCE_MS = 300;

type Props = {
  preview: Pick<
    NeighborhoodPreviewContext,
    | 'query'
    | 'changeQuery'
    | 'searchDestination'
    | 'addressResults'
    | 'isSearching'
    | 'searchError'
    | 'selectAddress'
    | 'hasChosenMapPoint'
    | 'mapCandidate'
    | 'openMapSearch'
    | 'isMapSelectionEnabled'
    | 'openMapSelection'
    | 'cancelMapSelection'
  >;
  disabled?: boolean;
};

/**
 * 출퇴근 장소 입력 칸(통근 분석의 기준점을 정한다). 위쪽 지도 검색창과 상태를 공유하지 않는 별도 기능이다.
 * 비어 있으면 검색 칸(자동완성 목록)과 `지도에서 선택`, 정해졌으면 이름과 주소와 `바꾸기`를 보인다.
 * 처음 쓰는 사람에게는 이 칸에 붙은 툴팁으로 한 번 알린다.
 */
const CommuteDestinationField = ({ preview, disabled = false }: Props) => {
  const searchRef = useRef(preview.searchDestination);
  searchRef.current = preview.searchDestination;
  const { query, hasChosenMapPoint } = preview;
  // 위쪽 지도 검색창과 결과 목록이 겹치지 않게 한 번에 하나만 연다.
  const dropdown = useExclusiveDropdown(useId());
  // 따로 제출하지 않고 입력이 멈추면 검색한다.
  useEffect(() => {
    if (query.trim() === '' || hasChosenMapPoint) return;
    const timer = window.setTimeout(() => void searchRef.current(), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, hasChosenMapPoint]);

  return (
    <section
      className={styles.field}
      aria-label="출퇴근 장소"
      data-search-root
      onFocus={() => {
        if (!hasChosenMapPoint) dropdown.open();
      }}
      onKeyDown={(event) => handleSearchKeys(event, dropdown.close)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) dropdown.close();
      }}
    >
      {hasChosenMapPoint ? (
        <div className={styles.chosen}>
          <div className={styles.chosenText}>
            <strong title={preview.mapCandidate.name}>{preview.mapCandidate.name}</strong>
            {preview.mapCandidate.address && preview.mapCandidate.address !== preview.mapCandidate.name && (
              <small>{preview.mapCandidate.address}</small>
            )}
          </div>
          <button className={styles.change} type="button" disabled={disabled} onClick={preview.openMapSearch}>
            바꾸기
          </button>
        </div>
      ) : (
        <div className={styles.searchWrap}>
          <SearchField
            className={styles.search}
            shape="pill"
            showSubmitButton={false}
            label="출퇴근 장소"
            placeholder="학교나 회사를 검색해요"
            value={preview.query}
            disabled={disabled}
            onValueChange={(value) => {
              dropdown.open();
              preview.changeQuery(value);
            }}
            onSubmit={() => void preview.searchDestination()}
          />
          <FinderSearchTip hasInput={preview.query.trim().length > 0} enabled />
        </div>
      )}
      {!hasChosenMapPoint && dropdown.isOpen && (
        // 결과를 누를 때 입력창의 포커스가 먼저 빠져 목록이 닫히지 않게 한다. 입력창이 아니라 이 칸(`지도에서 선택` 버튼까지)을 기준으로 넓게 깐다.
        <div onMouseDown={(event) => event.preventDefault()}>
          {preview.addressResults.length > 0 && (
            <AddressSearchResults
              dropdown
              wide
              status="success"
              results={preview.addressResults}
              onSelect={(address) => {
                dropdown.close();
                preview.selectAddress(address);
              }}
            />
          )}
          {preview.isSearching && (
            <AddressSearchResults dropdown wide status="loading" results={[]} onSelect={() => undefined} />
          )}
          {preview.searchError && !preview.isSearching && (
            <AddressSearchResults
              dropdown
              wide
              status="error"
              errorMessage={preview.searchError}
              results={[]}
              onSelect={() => undefined}
            />
          )}
        </div>
      )}
      {!hasChosenMapPoint && (
        <button
          className={styles.mapPick}
          type="button"
          aria-pressed={preview.isMapSelectionEnabled}
          disabled={disabled}
          onClick={() => {
            dropdown.close();
            if (preview.isMapSelectionEnabled) preview.cancelMapSelection();
            else preview.openMapSelection();
          }}
        >
          {preview.isMapSelectionEnabled ? '선택 취소' : '지도에서 선택'}
        </button>
      )}
    </section>
  );
};

const styles = {
  field: css`
    label: CommuteDestinationField-field;
    /* 결과 목록이 입력창이 아니라 이 칸 전체 너비를 기준으로 깔리게 한다. */
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  `,
  searchWrap: css`
    label: CommuteDestinationField-searchWrap;
    position: relative;
    flex: 1;
    min-width: 0;
  `,
  search: css`
    label: CommuteDestinationField-search;
    /* 한 줄, 높이 44px은 공용 검색창 기본값이다. */
    min-height: 44px;
  `,
  chosen: css`
    label: CommuteDestinationField-chosen;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
    min-height: 44px;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
  `,
  chosenText: css`
    label: CommuteDestinationField-chosenText;
    display: grid;
    min-width: 0;

    & strong {
      overflow: hidden;
      font-size: 0.9rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    & small {
      overflow: hidden;
      color: var(--color-muted);
      font-size: 0.72rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  change: css`
    label: CommuteDestinationField-change;
    flex: none;
    min-height: 2rem;
    padding: 0 0.75rem;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-brand-blue-ink) 10%, #fff);
    color: var(--color-brand-blue-ink);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 800;
    cursor: pointer;
  `,
  mapPick: css`
    label: CommuteDestinationField-mapPick;
    flex: none;
    height: 44px;
    padding: 0 0.8rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: #fff;
    color: var(--color-ink);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;

    &[aria-pressed='true'] {
      border-color: var(--color-brand-blue-ink);
      background: var(--color-brand-blue-ink);
      color: #fff;
    }
  `,
};

export default CommuteDestinationField;
