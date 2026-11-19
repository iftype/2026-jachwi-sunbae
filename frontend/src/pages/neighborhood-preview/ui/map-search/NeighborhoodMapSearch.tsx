import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import AddressSearchResults, { handleSearchKeys } from '@/features/map/ui/address-search-results/AddressSearchResults';
import DesktopHeaderSlot, { useHasDesktopHeaderSlot } from '@/shared/ui/desktop-header/DesktopHeaderSlot';
import Icon from '@/shared/ui/icon/Icon';
import SearchField from '@/shared/ui/search-field/SearchField';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';

import * as shared from '../../NeighborhoodPreviewPage.styles';

/** 입력을 멈추고 이만큼 지나면 검색한다. */
const SEARCH_DEBOUNCE_MS = 300;

type NeighborhoodMapSearchProps = {
  hideHome?: boolean;
  preview: Pick<
    NeighborhoodPreviewContext,
    | 'leave'
    | 'query'
    | 'changeQuery'
    | 'searchDestination'
    | 'shouldFocusMapSearch'
    | 'hasChosenMapPoint'
    | 'addressResults'
    | 'isSearching'
    | 'searchError'
    | 'selectAddress'
  >;
};

/**
 * 출퇴근 장소 검색창. 휴대폰은 인프라 지도처럼 지도 위 검색창 왼쪽에 흰 원형 홈 버튼을 두고,
 * 데스크탑은 검색창만 공용 헤더 가운데로 옮긴다. 헤더 메뉴로 화면을 오가므로 뒤로가기는 두지 않는다.
 * 헤더가 없는 공개 탐색은 휴대폰처럼 제자리에 홈 버튼과 함께 그린다.
 */
const NeighborhoodMapSearch = ({ preview, hideHome = false }: NeighborhoodMapSearchProps) => {
  const searchInHeader = useHasDesktopHeaderSlot();
  // 검색창에서 손을 떼(포커스가 밖으로 나가) 결과 목록을 닫는다. 다시 눌러 입력하면 다시 열린다.
  const [isOpen, setIsOpen] = useState(true);
  // 본 방 기록 검색창처럼 따로 제출하지 않고 입력이 멈추면 검색한다. searchDestination은 렌더마다 새로 만들어져 ref로 들고 있는다.
  const searchRef = useRef(preview.searchDestination);
  searchRef.current = preview.searchDestination;
  const { query, hasChosenMapPoint } = preview;
  useEffect(() => {
    if (query.trim() === '' || hasChosenMapPoint) return;
    const timer = window.setTimeout(() => void searchRef.current(), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, hasChosenMapPoint]);
  return (
    <DesktopHeaderSlot>
      <div className={searchInHeader ? shared.headerMapSearch : shared.mapSearch}>
        {!searchInHeader && !hideHome && (
          <button type="button" className={shared.mapBack} aria-label="홈으로 돌아가기" onClick={preview.leave}>
            <Icon name="home" size={22} />
          </button>
        )}
        <div
          className={styles.search}
          data-search-root
          onKeyDown={(event) => handleSearchKeys(event, () => setIsOpen(false))}
          onFocus={() => setIsOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
          }}
        >
          <SearchField
            className={shared.activeSearchField}
            shape="pill"
            showSubmitButton={false}
            label="출퇴근 장소"
            placeholder="주소로 지도 이동"
            value={preview.query}
            onValueChange={preview.changeQuery}
            onSubmit={() => {
              preview.searchDestination();
            }}
            autoFocus={preview.shouldFocusMapSearch}
          />
          {isOpen && !preview.hasChosenMapPoint && (
            // 결과를 누를 때 입력창의 포커스가 먼저 빠져 목록이 닫히지 않게 한다.
            <div onMouseDown={(event) => event.preventDefault()}>
              <AddressSearchResults
                results={preview.addressResults}
                dropdown
                recent={preview.query.trim() === ''}
                status={
                  preview.isSearching
                    ? 'loading'
                    : preview.searchError
                      ? 'error'
                      : preview.addressResults.length > 0
                        ? 'success'
                        : 'idle'
                }
                errorMessage={preview.searchError ?? undefined}
                onSelect={preview.selectAddress}
              />
            </div>
          )}
        </div>
      </div>
    </DesktopHeaderSlot>
  );
};

const styles = {
  search: css`
    position: relative;
    flex: 1;
    min-width: 0;
    pointer-events: auto;
  `,
};
export default NeighborhoodMapSearch;
