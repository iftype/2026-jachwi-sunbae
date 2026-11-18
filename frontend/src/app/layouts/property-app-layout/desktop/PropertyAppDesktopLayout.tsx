import { css } from '@emotion/css';
import { Link, Outlet } from 'react-router-dom';

import { MY_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';

import type { AppShellState } from '../appShell';
import { appShellAttributes } from '../appShell';

import * as shared from '../PropertyAppLayout.styles';

type Props = {
  shell: AppShellState;
};

/** 데스크탑 앱 셸. 화면 전체 폭에 홈 로고·주요 화면 메뉴가 있는 공용 헤더를 둔다. */
const PropertyAppDesktopLayout = ({ shell }: Props) => (
  <div className={`${shared.root} ${styles.root}`} {...appShellAttributes(shell)}>
    <nav className={styles.navigation} aria-label="화면 이동">
      <Link to={RECORDS_PATH}>지도</Link>
      <Link to={MY_PATH}>마이</Link>
    </nav>
    <div className={`${shared.content} ${styles.content}`}>
      <Outlet />
    </div>
  </div>
);

const styles = {
  navigation: css`
    label: PropertyAppDesktopLayout-navigation;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1rem 1.5rem;
    & a {
      color: var(--color-ink);
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
