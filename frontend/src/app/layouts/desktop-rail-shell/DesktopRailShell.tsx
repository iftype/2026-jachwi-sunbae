import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { MY_PATH, NEIGHBORHOODS_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import NavRail from '@/shared/ui/nav-rail/NavRail';
import { NAV_RAIL_ITEMS } from '@/shared/ui/nav-rail/navRailItems';

const SHELL_PATHS: Record<string, string> = {
  register: RECORDS_PATH,
  records: RECORDS_PATH,
  neighborhoods: NEIGHBORHOODS_PATH,
  my: MY_PATH,
};

/**
 * 지도 화면이 아닌 화면(방 비교, 체크리스트, 저렴한 한 끼, 사용방법)을 데스크탑에서 감싸는 왼쪽 네비 레일 틀.
 * 지도 화면과 같은 칸 구성과 모양이라, 어느 화면에서든 같은 곳에서 이동한다. 휴대폰에서는 레일 없이 화면만 그린다.
 */
const DesktopRailShell = ({ children }: { children: ReactNode }) => {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!isDesktop) return <>{children}</>;
  return (
    <div className={styles.shell}>
      <NavRail
        label="화면 이동"
        items={NAV_RAIL_ITEMS.map((item) => ({
          ...item,
          // 지금 보고 있는 도구 화면은 레일에서 칠한다. 지도 화면은 이 틀 밖이라 칠하지 않는다.
          isActive: item.path !== undefined && pathname.startsWith(item.path),
          onSelect: () => navigate(item.path ?? SHELL_PATHS[item.key]),
        }))}
      />
      <div className={styles.content}>{children}</div>
    </div>
  );
};

const styles = {
  shell: css`
    label: DesktopRailShell-shell;
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    min-height: 100dvh;

    & > nav {
      position: sticky;
      top: 0;
      height: 100dvh;
    }
  `,
  content: css`
    label: DesktopRailShell-content;
    position: relative;
    min-width: 0;
  `,
};

export default DesktopRailShell;
