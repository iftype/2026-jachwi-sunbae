import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { LOGO_DUCK } from '@/shared/assets/imageAssets';
import { COMPARE_PATH, HOME_PATH, MY_PATH, NEIGHBORHOODS_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import IdentityPlaceholder from '@/shared/ui/identity-placeholder/IdentityPlaceholder';

import { useRegisterDesktopHeaderSlot } from './DesktopHeaderSlot';

const { src: logo, src2x: logo2x } = LOGO_DUCK;

/** 데스크탑 헤더에서 바로 옮겨 갈 수 있는 주요 화면. */
const NAV_ITEMS = [
  { label: '본 방 기록', to: RECORDS_PATH },
  { label: '동네 찾기', to: NEIGHBORHOODS_PATH },
  { label: '방 비교', to: COMPARE_PATH },
] as const;

type DesktopHeaderProps = {
  className?: string;
  /** 화면 전용 요소 자리(홈의 날씨 등). 로고와 메뉴 사이 빈 곳 가운데에 둔다. */
  center?: ReactNode;
};

/**
 * 데스크탑 화면 공통 헤더. 왼쪽 위 로고로 홈에 가고(로고 옆에 화면 이름은 두지 않는다), 가운데에는 화면별 요소(검색창 등)를,
 * 오른쪽 메뉴로 주요 화면을 바로 옮겨 다니며,
 * 맨 오른쪽 프로필로 마이페이지에 간다. 홈 헤더와 로고·프로필 위치를 맞춘다.
 */
const DesktopHeader = ({ className, center }: DesktopHeaderProps) => {
  const registerSlot = useRegisterDesktopHeaderSlot();

  return (
    <header className={`${styles.header} ${className ?? ''}`.trim()}>
      <Link className={styles.homeLogo} to={HOME_PATH} aria-label="홈으로 돌아가기">
        <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} width={64} height={64} alt="" />
      </Link>
      {/* 지도 화면의 검색창처럼 화면마다 헤더 가운데에 두는 요소가 들어오는 자리. */}
      <div ref={registerSlot} className={styles.slot} />
      {center !== undefined && <div className={styles.center}>{center}</div>}
      <nav className={styles.nav} aria-label="주요 화면">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <NavLink className={styles.profile} to={MY_PATH} aria-label="마이페이지">
        <IdentityPlaceholder size={44} />
      </NavLink>
    </header>
  );
};

/*
 * css 템플릿 안의 주석은 그대로 main 번들에 실린다. 헤더는 첫 화면부터 쓰므로 설명은 템플릿 밖에 둔다.
 */
const styles = {
  /*
   * 화면마다 기준 글자 크기(rem)를 키우는 경우가 있어도 헤더는 어디서나 같은 크기로 보이게
   * 글자 크기를 16px로 고정하고 안쪽 크기는 em으로 잡는다.
   * 가운데 자리가 비어도 메뉴·마이페이지 위치가 바뀌지 않게 격자 대신 가로 줄로 둔다.
   * 화면마다 표면색 변수가 달라도 헤더는 흰색으로 통일한다.
   */
  header: css`
    label: DesktopHeader-header;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 1em;
    box-sizing: border-box;
    position: relative;
    width: 100%;
    padding: max(1.1em, env(safe-area-inset-top)) 1.5em 0.8em;
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

  /* 화면 전용 요소(홈의 날씨 등)는 메뉴 수와 상관없이 헤더 정가운데에 둔다. */
  center: css`
    label: DesktopHeader-center;
    position: absolute;
    left: 50%;
    display: flex;
    max-width: 40%;
    min-width: 0;
    justify-content: center;
    transform: translateX(-50%);
  `,

  /*
   * 좁은 데스크탑(1024px)에서도 메뉴 이름이 두 줄로 꺾이지 않게 메뉴는 줄이지 않고 가운데 검색 자리가 줄어든다.
   * 메뉴는 마우스를 올리면 살짝 둥근 네모로 옅게만 표시하고, 지금 화면은 파란 글자로 둔다.
   */
  nav: css`
    label: DesktopHeader-nav;
    display: flex;
    flex: none;
    gap: 0;
    margin-left: auto;

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

  /* 메뉴와 구분되도록 마이페이지는 메뉴에서 조금 떨어뜨린다. 지금 화면이 마이면 메뉴의 파란 글자처럼 옅은 파란 바탕으로 표시한다. */
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

    &[aria-current='page'] {
      background: #eef3fd;
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
    }
  `,
};

export default DesktopHeader;
