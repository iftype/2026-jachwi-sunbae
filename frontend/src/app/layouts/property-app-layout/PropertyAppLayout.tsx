import { useLocation } from 'react-router-dom';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import {
  ADDRESS_SEARCH_PATH,
  CHECKLISTS_PATH,
  COMPARE_PATH,
  MAP_SELECT_LOCATION_PATH,
  MY_PATH,
  NEIGHBORHOODS_NEARBY_PATH,
  NEIGHBORHOODS_PATH,
} from '@/shared/lib/navigation/appPaths';
import { DesktopHeaderSlotProvider } from '@/shared/ui/desktop-header/DesktopHeaderSlot';

import type { AppShellState } from './appShell';
import PropertyAppDesktopLayout from './desktop/PropertyAppDesktopLayout';
import PropertyAppMobileLayout from './mobile/PropertyAppMobileLayout';

/** 로그인 뒤 앱 화면의 셸. 화면 주소로 배치 상태를 정하고, 데스크탑·휴대폰 셸을 여기서 한 번만 고른다. */
const PropertyAppLayout = () => {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  // 미리보기 매물은 음수 id(-1)라 앞의 `-`도 받는다.
  const isPropertyDetailPath = /^\/properties\/-?\d+$/.test(location.pathname);
  const isChecklistPage = location.pathname === CHECKLISTS_PATH || location.pathname.startsWith(`${CHECKLISTS_PATH}/`);
  const isMapPage =
    location.pathname === NEIGHBORHOODS_PATH || location.pathname.startsWith(`${NEIGHBORHOODS_PATH}/areas/`);
  // 매물 사진·메모·수정·주변 분석과 동네 주변 분석은 상세로 돌아가는 자체 "<"를 쓴다.
  // 홈으로 가는 상단 바를 위에 겹치면 그 "<"를 눌러 홈으로 빠져나가 버린다.
  const hasOwnBackNavigation =
    /^\/properties\/-?\d+\/(photos|memo|edit|nearby)$/.test(location.pathname) ||
    /^\/properties\/-?\d+\/active-checklists\/(ON_SITE|PRE_CONTRACT)$/.test(location.pathname) ||
    location.pathname === NEIGHBORHOODS_NEARBY_PATH ||
    // 주소 검색 화면은 자체 "<"와 검색창을 쓴다.
    location.pathname === ADDRESS_SEARCH_PATH;
  const shell: AppShellState = {
    fullScreen:
      location.pathname === MAP_SELECT_LOCATION_PATH ||
      location.pathname === ADDRESS_SEARCH_PATH ||
      isPropertyDetailPath ||
      // 체크리스트 편집은 자체 상단 내비게이션을 쓴다.
      isChecklistPage ||
      /^\/properties\/-?\d+\/checklists\/\d+$/.test(location.pathname),
    isMapPage,
    isPropertyDetailPath,
    isHomeWidthPage: location.pathname === MY_PATH || isChecklistPage,
    // 방 비교도 휴대폰에서 좌우 빈 공간 없이 화면 폭을 다 쓴다.
    isWidePage: isChecklistPage || location.pathname === COMPARE_PATH,
  };

  return (
    <DesktopHeaderSlotProvider>
      {isDesktop ? (
        <PropertyAppDesktopLayout shell={shell} />
      ) : (
        // 방 비교는 자체 상단 내비게이션이 홈으로 돌아가므로 상단 바를 겹쳐 두지 않는다.
        // 동네 찾기 지도는 지도·검색을 화면 위까지 쓰므로 상단 바를 두지 않는다.
        // 마이는 동네 찾기 등과 같은 "<" 상단 바를 쓰고, 그 옆에 화면 제목을 둔다.
        <PropertyAppMobileLayout
          shell={shell}
          hidesAppBar={location.pathname === COMPARE_PATH || isMapPage || hasOwnBackNavigation}
          appBarTitle={location.pathname === MY_PATH ? '마이페이지' : undefined}
        />
      )}
    </DesktopHeaderSlotProvider>
  );
};

export default PropertyAppLayout;
