import { css } from '@emotion/css';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import AreaSkeleton from '@/shared/ui/area-skeleton/AreaSkeleton';
import ListDetailLayout from '@/shared/ui/list-detail-layout/ListDetailLayout';
import { NavRailPlaceholder } from '@/shared/ui/nav-rail/NavRail';
import { NAV_RAIL_ITEMS } from '@/shared/ui/nav-rail/navRailItems';

const LOADING_LABEL = '동네 찾기를 불러오는 중이에요.';

/**
 * 동네 찾기 화면의 코드를 받는 동안 Suspense fallback으로 보여 주는 뼈대. 진행 표시 대신 늦추지 않고 바로 배치를 보여 준다.
 * 데스크탑은 실제 화면과 같은 폭 규칙(ListDetailLayout)으로 목록 영역과 지도 영역을, 휴대폰은 화면 전체의 지도 영역만 채운다.
 */
const NeighborhoodPageSkeleton = () => (
  <main className={page}>
    {useIsDesktop() ? (
      <div className={withRail}>
        <NavRailPlaceholder items={NAV_RAIL_ITEMS} />
        <ListDetailLayout list={<AreaSkeleton area="list" label={LOADING_LABEL} />}>
          <AreaSkeleton area="map" />
        </ListDetailLayout>
      </div>
    ) : (
      <AreaSkeleton area="map" label={LOADING_LABEL} />
    )}
  </main>
);

/* 실제 화면의 틀(NeighborhoodPreviewPage.styles의 page)과 같은 크기. 첫 번들에 들어가므로 그 파일을 불러오지 않고 필요한 값만 둔다. */
const withRail = css`
  label: NeighborhoodPageSkeleton-withRail;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
`;

const page = css`
  label: NeighborhoodPageSkeleton-page;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
`;

export default NeighborhoodPageSkeleton;
