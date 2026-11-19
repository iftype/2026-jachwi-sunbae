import { css } from '@emotion/css';
import { useEffect } from 'react';

import MapHeaderWeather from '@/features/weather/ui/map-header-weather/MapHeaderWeather';
import { MOBILE_BOTTOM_TABS_ENABLED } from '@/shared/ui/bottom-tab-bar/bottomTabConfig';
import { Button } from '@/shared/ui/button/Button';
import { MapModeSwitchTile, useHasMapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';
import MobileMapHeader, { MapHomeLink } from '@/shared/ui/mobile-map-header/MobileMapHeader';

import type { RecordsView } from '../model/recordsView';
import RecordFinderChip from '../ui/record-finder-chip/RecordFinderChip';

type Props = {
  view: RecordsView;
  onRecord: () => void;
  searchTo?: string;
};
/**
 * 휴대폰 기록 헤더. 지도 보기에서는 왼쪽에 동네 찾기와 내 기록을 오가는 타일을, 리스트 보기와 통합 지도 밖에서는 로고를 두고, 로고 옆 빈 곳에 동네 찾기 칩을 둔다.
 */
const RecordsMobileHeader = ({ view, searchTo, onRecord }: Props) => {
  const showsModeTile = useHasMapModeSwitch() && view === 'map' && !MOBILE_BOTTOM_TABS_ENABLED;
  // 검색 아이콘을 누르면 바로 열리도록, 주소 검색 화면 코드를 미리 받아 둔다.
  useEffect(() => {
    void import('@/pages/address-search/AddressSearchPage');
  }, []);
  return (
    <div className={styles.header}>
      <MobileMapHeader
        searchTo={searchTo}
        hideSearch={view === 'list'}
        hideProfile={view === 'list'}
        trailing={
          view === 'list' && (
            <Button className={styles.record} onClick={onRecord}>
              매물 기록하기
            </Button>
          )
        }
        center={view === 'list' ? <MapHeaderWeather /> : showsModeTile ? undefined : <RecordFinderChip />}
        leading={showsModeTile ? <MapModeSwitchTile /> : <MapHomeLink />}
      />
    </div>
  );
};
const styles = {
  record: css`
    min-height: 2.75rem;
    white-space: nowrap;
  `,
  header: css`
    label: RecordsMobileHeader-root;
    padding: calc(env(safe-area-inset-top) + 0.75rem) 0.85rem 0.5rem;
  `,
};
export default RecordsMobileHeader;
