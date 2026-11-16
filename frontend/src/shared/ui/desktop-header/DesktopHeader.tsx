import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import iconProfile from '@/shared/assets/icon-profile.webp';
import { LOGO_DUCK } from '@/shared/assets/imageAssets';
import {
  CHEAP_MEALS_PATH,
  CHECKLISTS_PATH,
  COMPARE_PATH,
  HOME_PATH,
  MY_PATH,
  NEIGHBORHOODS_PATH,
  RECORDS_PATH,
} from '@/shared/lib/navigation/appPaths';

import { useRegisterDesktopHeaderSlot } from './DesktopHeaderSlot';

const { src: logo, src2x: logo2x } = LOGO_DUCK;

/** 데스크탑 헤더에서 바로 옮겨 갈 수 있는 주요 화면. */
const HOME_NAV_ITEMS = [
  { label: '본 방 기록', to: RECORDS_PATH },
  { label: '동네 찾기', to: NEIGHBORHOODS_PATH },
] as const;

const DESKTOP_NAV_ITEMS = [
  ...HOME_NAV_ITEMS,
  { label: '체크리스트', to: CHECKLISTS_PATH },
  { label: '방 비교', to: COMPARE_PATH },
  { label: '저렴한 한 끼', to: CHEAP_MEALS_PATH },
] as const;

type DesktopHeaderProps = {
  className?: string;
  homeNavigation?: boolean;
  /** 화면 전용 요소 자리(홈의 날씨 등). 로고와 메뉴 사이 빈 곳 가운데에 둔다. */
  center?: ReactNode;
};

/**
 * 데스크탑 화면 공통 헤더. 왼쪽 위 로고로 홈에 가고(로고 옆에 화면 이름은 두지 않는다), 가운데에는 화면별 요소(검색창 등)를,
 * 오른쪽 메뉴로 주요 화면을 바로 옮겨 다니며,
 * 맨 오른쪽 프로필로 마이페이지에 간다. 홈 헤더와 로고·프로필 위치를 맞춘다.
 */
const DesktopHeader = ({ className, center, homeNavigation = false }: DesktopHeaderProps) => {
  const registerSlot = useRegisterDesktopHeaderSlot();
  const navItems = homeNavigation ? HOME_NAV_ITEMS : DESKTOP_NAV_ITEMS;

  return (
    <header className={`${styles.header} ${className ?? ''}`.trim()}>
      <Link className={styles.homeLogo} to={HOME_PATH} aria-label="홈으로 돌아가기">
        <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} width={64} height={64} alt="" />
      </Link>
      {/* 지도 화면의 검색창처럼 화면마다 헤더 가운데에 두는 요소가 들어오는 자리. */}
      <div ref={registerSlot} className={styles.slot} />
      {center !== undefined && <div className={styles.center}>{center}</div>}
      <nav className={styles.nav} aria-label="주요 화면">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Link className={styles.profile} to={MY_PATH} aria-label="마이페이지">
        <img src={iconProfile} alt="" width={96} height={96} />
      </Link>
    </header>
  );
};

const styles = {
  header: css`
    label: DesktopHeader-header;
    /*
     * 화면마다 기준 글자 크기(rem)를 키우는 경우가 있어도 헤더는 어디서나 같은 크기로 보이게
     * 글자 크기를 16px로 고정하고 안쪽 크기는 em으로 잡는다.
     */
    font-size: 16px;
    /* 가운데 자리가 비어도 메뉴·마이페이지 위치가 바뀌지 않게 격자 대신 가로 줄로 둔다. */
    display: flex;
    align-items: center;
    gap: 1em;
    box-sizing: border-box;
    width: 100%;
    padding: max(1.1em, env(safe-area-inset-top)) 1.5em 0.8em;
    /* 화면마다 표면색 변수가 달라도 헤더는 흰색으로 통일한다. */
    background: #fff;
    border-bottom: 1px solid #eceef1;
  `,

  homeLogo: css`
    label: DesktopHeader-homeLogo;
    display: block;
    border-radius: 0.75em;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
    }

    & img {
      display: block;
      width: 2.5em;
      height: 2.5em;
      border-radius: 0.75em;
    }
  `,

  /*
   * 가운데 자리는 로고와 같은 높이로 고정한다. 화면 기준 글자 크기(rem)로 그린 검색창이 로고보다 조금 높아도
   * 헤더 높이가 검색창 유무에 따라 바뀌지 않게 해, 아래 지도가 크기를 다시 잡으며 깜빡이지 않게 한다.
   */
  slot: css`
    label: DesktopHeader-slot;
    display: flex;
    min-width: 0;
    height: 2.5em;
    flex: 0 1 28em;
    align-items: center;
    gap: 0.5em;

    &:empty {
      display: none;
    }
  `,

  center: css`
    label: DesktopHeader-center;
    display: flex;
    min-width: 0;
    flex: 1;
    justify-content: center;
  `,

  nav: css`
    label: DesktopHeader-nav;
    display: flex;
    /* 좁은 데스크탑(1024px)에서도 메뉴 이름이 두 줄로 꺾이지 않게 메뉴는 줄이지 않고 가운데 검색 자리가 줄어든다. */
    flex: none;
    gap: 0;
    margin-left: auto;

    /* 메뉴는 마우스를 올리면 살짝 둥근 네모로 옅게만 표시하고, 지금 화면은 파란 글자로 둔다. */
    & a {
      padding: 0.5em 0.6em;
      border-radius: 0.5em;
      color: #6b7079;
      font-size: 0.95em;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      transition:
        background-color 0.18s ease,
        color 0.18s ease;
    }

    & a:hover {
      background: #f6f7f9;
      color: #25282d;
    }

    & a[aria-current='page'] {
      color: var(--color-brand-blue);
      font-weight: 700;
    }

    & a[aria-current='page']:hover {
      color: var(--color-brand-blue);
    }
  `,

  /* 메뉴와 구분되도록 마이페이지는 메뉴에서 조금 떨어뜨린다. */
  profile: css`
    label: DesktopHeader-profile;
    display: grid;
    margin-left: 1em;
    width: 2.4em;
    height: 2.4em;
    border-radius: 0.5em;
    place-items: center;
    transition: background-color 0.18s ease;

    & img {
      width: 2.1em;
      height: 2.1em;
    }

    &:hover {
      background: #f6f7f9;
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
    }
  `,
};

export default DesktopHeader;
