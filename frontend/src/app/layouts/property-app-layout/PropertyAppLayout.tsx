import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';

import type { Member } from '@/features/auth/model/Member';
import { DESIGN_HOME_PATH, isDesignShell } from '@/shared/lib/navigation/designShell';
import Icon from '@/shared/ui/icon/Icon';

import { MAIN_TABS } from './mainTabs';

import styles from './PropertyAppLayout.module.css';

const PropertyAppLayout = () => {
  const member = useOutletContext<Member>();
  const location = useLocation();
  const fullScreen =
    location.pathname === '/map/select-location' ||
    location.pathname.startsWith('/properties/new') ||
    /^\/properties\/\d+$/.test(location.pathname) ||
    location.pathname === '/checklists/new' ||
    /^\/checklists\/\d+$/.test(location.pathname) ||
    /^\/properties\/\d+\/checklists\/\d+$/.test(location.pathname);

  const designShell = isDesignShell();
  // 마이·방 비교는 자체 상단 내비게이션이 시안 홈으로 돌아가므로 시안 헤더를 겹쳐 두지 않는다.
  // 동네 찾기 지도는 지도·검색을 화면 위까지 쓰므로 시안 헤더를 두지 않는다.
  const hidesDesignBar =
    location.pathname === '/me' ||
    location.pathname === '/compare' ||
    location.pathname.startsWith('/neighborhoods/map');

  return (
    <div
      className={styles.root}
      data-design-shell={designShell || undefined}
      data-full-screen={fullScreen || undefined}
      data-map-page={location.pathname === '/map' || location.pathname.startsWith('/neighborhoods/map') || undefined}
      data-wide-property-page={
        location.pathname === '/properties' || /^\/properties\/\d+$/.test(location.pathname) || undefined
      }
    >
      {designShell && !fullScreen && !hidesDesignBar && (
        <header className={styles.designBar}>
          <Link to={DESIGN_HOME_PATH} className={styles.designHome} aria-label="홈으로 돌아가기">
            <Icon name="chevron-left" size={24} />
          </Link>
        </header>
      )}
      <div className={styles.content}>
        <Outlet context={member} />
      </div>
      {!designShell && !fullScreen && (
        <nav className={styles.bottomNavigation} aria-label="주요 메뉴">
          {MAIN_TABS.map((tab) => (
            <NavLink key={tab.key} to={tab.path} aria-label={tab.label}>
              <Icon name={tab.icon} size={20} />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};

export default PropertyAppLayout;
