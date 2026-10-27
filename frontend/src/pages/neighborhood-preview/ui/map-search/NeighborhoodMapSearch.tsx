import DesktopHeaderSlot, { useHasDesktopHeaderSlot } from '@/shared/ui/desktop-header/DesktopHeaderSlot';
import Icon from '@/shared/ui/icon/Icon';
import SearchField from '@/shared/ui/search-field/SearchField';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';

import shared from '../../NeighborhoodPreviewPage.module.css';

type NeighborhoodMapSearchProps = {
  preview: Pick<
    NeighborhoodPreviewContext,
    'leave' | 'query' | 'changeQuery' | 'searchDestination' | 'shouldFocusMapSearch'
  >;
};

/**
 * 출퇴근 장소 검색창. 휴대폰은 인프라 지도처럼 지도 위 검색창 왼쪽에 흰 원형 뒤로가기를 두고,
 * 데스크탑은 둘 다 공용 헤더 가운데로 옮긴다(헤더가 없는 공개 탐색은 제자리에 그린다).
 */
const NeighborhoodMapSearch = ({ preview }: NeighborhoodMapSearchProps) => {
  const searchInHeader = useHasDesktopHeaderSlot();
  return (
    <DesktopHeaderSlot>
      <div className={searchInHeader ? shared.headerMapSearch : shared.mapSearch}>
        <button type="button" className={shared.mapBack} aria-label="뒤로 가기" onClick={preview.leave}>
          <Icon name="chevron-left" size={24} />
        </button>
        <SearchField
          className={shared.activeSearchField}
          shape="pill"
          showSubmitButton
          label="출퇴근 장소"
          placeholder="출퇴근하는 장소 검색"
          value={preview.query}
          onValueChange={preview.changeQuery}
          onSubmit={() => {
            preview.searchDestination();
          }}
          autoFocus={preview.shouldFocusMapSearch}
        />
      </div>
    </DesktopHeaderSlot>
  );
};

export default NeighborhoodMapSearch;
