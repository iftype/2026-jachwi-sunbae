import { css } from '@emotion/css';
import { lazy, Suspense } from 'react';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import AreaSkeleton from '@/shared/ui/area-skeleton/AreaSkeleton';
import ListDetailLayout from '@/shared/ui/list-detail-layout/ListDetailLayout';
import MapListHeader from '@/shared/ui/map-list-header/MapListHeader';
import MapViewSwitch from '@/shared/ui/map-view-switch/MapViewSwitch';
import { NavRailPlaceholder } from '@/shared/ui/nav-rail/NavRail';
import { NAV_RAIL_ITEMS } from '@/shared/ui/nav-rail/navRailItems';

import useRecordsView from './hooks/useRecordsView';

import * as desktopStyles from './desktop/RecordsDesktopPage.styles';
import * as mobileStyles from './mobile/RecordsMobilePage.styles';

const RecordsMobileHeader = lazy(() => import('./mobile/RecordsMobileHeader'));

export const RECORDS_LOADING_LABEL = '기록을 불러오는 중이에요.';

/**
 * 본 방 기록 화면의 코드를 받는 동안 Suspense fallback으로 보여 주는 뼈대.
 * 처음 여는 화면이라 남겨 둘 내용이 없으므로 늦추지 않고 바로 보여 준다.
 * 화면이 그려진 뒤 기록을 받는 동안에도 같은 자리에 같은 뼈대를 두어, 뼈대에서 내용으로 한 번만 바뀐다.
 * 뼈대는 목록 영역과 지도 영역의 배치만 채운다. 데스크탑은 실제 화면과 같은 폭 규칙(ListDetailLayout)으로 두 영역을 함께 두고,
 * 휴대폰은 지금 보기 방식(지도, 리스트)의 한 영역만 둔다.
 */
const RecordsPageSkeleton = () => (useIsDesktop() ? <DesktopSkeleton /> : <MobileSkeleton />);

const DesktopSkeleton = () => (
  <main className={`${desktopStyles.page} ${withRail}`}>
    <NavRailPlaceholder items={NAV_RAIL_ITEMS} />
    <div className={desktopStyles.frame}>
      <ListDetailLayout
        className={desktopStyles.body}
        list={
          <>
            <MapListHeader />
            <AreaSkeleton area="list" label={RECORDS_LOADING_LABEL} />
          </>
        }
      >
        <AreaSkeleton area="map" />
      </ListDetailLayout>
    </div>
  </main>
);

/* 실제 화면처럼 맨 왼쪽에 네비 레일 자리를 두고 나머지를 본문으로 쓴다. */
const withRail = css`
  label: RecordsPageSkeleton-withRail;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
`;

const MobileSkeleton = () => {
  const [view, setView] = useRecordsView();
  return (
    <main className={mobileStyles.page}>
      <div className={mobileStyles.frame}>
        {/* 지도 보기는 실제 화면처럼 뼈대 위에 헤더를 띄워, 흰 띠가 생겼다 사라지지 않게 한다. */}
        <div className={view === 'map' ? mobileStyles.mapChrome : undefined}>
          <Suspense fallback={<MapListHeader searchInRow />}>
            <RecordsMobileHeader view={view} onViewChange={setView} />
          </Suspense>
        </div>
        <div className={mobileStyles.body}>
          <AreaSkeleton area={view === 'map' ? 'map' : 'list'} label={RECORDS_LOADING_LABEL} />
        </div>
        <MapViewSwitch value={view} onChange={setView} label="기록 보기 방식" />
      </div>
    </main>
  );
};

export default RecordsPageSkeleton;
