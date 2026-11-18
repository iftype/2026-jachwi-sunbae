import { css } from '@emotion/css';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { MY_PATH, NEIGHBORHOODS_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import NavRail from '@/shared/ui/nav-rail/NavRail';
import { NAV_RAIL_ITEMS } from '@/shared/ui/nav-rail/navRailItems';

import type { AppShellState } from '../appShell';
import { appShellAttributes } from '../appShell';

import * as shared from '../PropertyAppLayout.styles';

type Props = {
  shell: AppShellState;
};

/**
 * 데스크탑 앱 셸. 지도 화면과 같은 왼쪽 네비 레일(내 기록, 동네 찾기, 마이)을 두고 오른쪽에 화면을 놓는다.
 * 방 비교, 체크리스트, 저렴한 한 끼, 사용방법처럼 지도 밖 화면도 같은 이동 방식과 모양을 쓴다.
 */
const PropertyAppDesktopLayout = ({ shell }: Props) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const paths: Record<string, string> = {
    records: RECORDS_PATH,
    neighborhoods: NEIGHBORHOODS_PATH,
    my: MY_PATH,
  };
  return (
    <div className={`${shared.root} ${styles.root}`} {...appShellAttributes(shell)}>
      <div className={styles.shell}>
        <NavRail
          label="화면 이동"
          items={NAV_RAIL_ITEMS.map((item) => {
            const path = item.path ?? paths[item.key];
            return {
              ...item,
              // 지금 보고 있는 도구 화면(체크리스트, 방 비교 등)은 레일에서 칠한다. 지도 화면은 이 틀 밖이라 칠하지 않는다.
              isActive: item.path !== undefined && pathname.startsWith(item.path),
              onSelect: () => navigate(path),
            };
          })}
        />
        <div className={`${shared.content} ${styles.content}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const styles = {
  /* 왼쪽 레일 + 오른쪽 화면. 레일은 화면 높이만큼 고정되고 화면만 스크롤한다. */
  shell: css`
    label: PropertyAppDesktopLayout-shell;
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    min-height: 100dvh;

    & > nav {
      position: sticky;
      top: 0;
      height: 100dvh;
    }
  `,
  /*
   * 데스크탑은 화면 전체 폭에 공용 헤더를 두고, 지도가 아닌 화면의 내용만 48rem 가운데 열에 둔다.
   * 기준 글자 크기(rem)는 125%로 올린다. 공용 데스크탑 헤더는 글자 크기를 px로 고정해 이 배율의 영향을 받지 않는다.
   */
  root: css`
    label: PropertyAppDesktopLayout-root;

    &[data-design-shell='true'] {
      width: 100%;
      background: var(--color-canvas);
    }

    html:has(&[data-design-shell='true']:not([data-map-page='true'])) {
      font-size: 125%;
    }
  `,

  /* 홈과 같은 폭을 쓰는 화면(마이)은 폭을 스스로 정한다. */
  content: css`
    label: PropertyAppDesktopLayout-content;

    .PropertyAppLayout-root[data-design-shell='true']:not([data-map-page='true']):not([data-home-width-page='true'])
      &
      > * {
      width: min(100%, 48rem);
      margin-right: auto;
      margin-left: auto;
    }
  `,
};

export default PropertyAppDesktopLayout;
