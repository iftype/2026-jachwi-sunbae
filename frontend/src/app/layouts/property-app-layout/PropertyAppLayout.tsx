import { Link, Outlet, useLocation, useOutletContext } from 'react-router-dom';

import type { Member } from '@/features/auth/model/Member';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import DesktopHeader from '@/shared/ui/desktop-header/DesktopHeader';
import { DesktopHeaderSlotProvider } from '@/shared/ui/desktop-header/DesktopHeaderSlot';
import Icon from '@/shared/ui/icon/Icon';

import styles from './PropertyAppLayout.module.css';

const PropertyAppLayout = () => {
  const member = useOutletContext<Member>();
  const location = useLocation();
  // 데스크탑은 모든 화면 위에 홈 로고·주요 화면 메뉴가 있는 공용 헤더를 둔다. 지도 주소 판단도 이 값을 쓴다.
  const isDesktop = useIsDesktop();
  // 지도에서 연 매물(`/map/:propertyId`)은 데스크탑이면 지도 화면, 휴대폰이면 상세 화면이다.
  const isMapPropertyPath = /^\/map\/\d+$/.test(location.pathname);
  const isPropertyDetailPath = /^\/properties\/\d+$/.test(location.pathname) || (!isDesktop && isMapPropertyPath);
  const isMapPage =
    location.pathname === '/map' ||
    (isDesktop && isMapPropertyPath) ||
    location.pathname.startsWith('/neighborhoods/map');
  const fullScreen =
    location.pathname === '/map/select-location' ||
    location.pathname.startsWith('/properties/new') ||
    isPropertyDetailPath ||
    location.pathname === '/checklists/new' ||
    /^\/checklists\/\d+$/.test(location.pathname) ||
    /^\/properties\/\d+\/checklists\/\d+$/.test(location.pathname);

  // 로그인 뒤 화면은 바텀탭 없이 홈으로 돌아가는 상단 바만 둔다.
  // 마이·방 비교는 자체 상단 내비게이션이 홈으로 돌아가므로 상단 바를 겹쳐 두지 않는다.
  // 인프라 지도·동네 찾기 지도는 지도·검색을 화면 위까지 쓰므로 상단 바를 두지 않는다.
  const hidesDesignBar = location.pathname === '/me' || location.pathname === '/compare' || isMapPage;

  return (
    <DesktopHeaderSlotProvider>
      <div
        className={styles.root}
        data-design-shell
        data-full-screen={fullScreen || undefined}
        data-map-page={isMapPage || undefined}
        data-wide-property-page={isPropertyDetailPath || undefined}
      >
        {isDesktop && <DesktopHeader />}
        {!isDesktop && !fullScreen && !hidesDesignBar && (
          <header className={styles.designBar}>
            <Link to={HOME_PATH} className={styles.designHome} aria-label="홈으로 돌아가기">
              <Icon name="chevron-left" size={24} />
            </Link>
          </header>
        )}
        <div className={styles.content}>
          <Outlet context={member} />
        </div>
      </div>
    </DesktopHeaderSlotProvider>
  );
};

export default PropertyAppLayout;
