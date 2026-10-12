import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';

import type { Member } from '@/features/auth/model/Member';
import { hasNativeAppFeature } from '@/shared/lib/native-app/nativeApp';
import Icon from '@/shared/ui/icon/Icon';

import { MAIN_TABS } from './mainTabs';
import useNativeTabBar from './useNativeTabBar';

import styles from './PropertyAppLayout.module.css';

const PropertyAppLayout = () => {
  const member = useOutletContext<Member>();
  const location = useLocation();
  const fullScreen =
    location.pathname === '/map/select-location' ||
    location.pathname.startsWith('/properties/new') ||
    location.pathname === '/checklists/new' ||
    /^\/checklists\/\d+$/.test(location.pathname) ||
    /^\/properties\/\d+\/checklists\/\d+$/.test(location.pathname);

  const hasNativeTabBar = useNativeTabBar(!fullScreen);

  return (
    <div
      className={styles.root}
      data-full-screen={fullScreen || undefined}
      data-native-tab-bar={hasNativeTabBar || undefined}
      data-native-tab-overlay={hasNativeTabBar && hasNativeAppFeature('tab-bar-overlay') ? true : undefined}
      data-map-page={location.pathname === '/map' || undefined}
    >
      <div className={styles.content}>
        <Outlet context={member} />
      </div>
      {!fullScreen && !hasNativeTabBar && (
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
