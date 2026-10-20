import { Link, NavLink } from 'react-router-dom';

import iconProfile from '@/shared/assets/icon-profile.webp';
import logo from '@/shared/assets/jachwi-sunbae-goose.webp';
import { HOME_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';

import { useRegisterDesktopHeaderSlot } from './DesktopHeaderSlot';

import styles from './DesktopHeader.module.css';

/** 데스크탑 헤더에서 바로 옮겨 갈 수 있는 주요 화면. */
const DESKTOP_NAV_ITEMS = [
  { label: '본 방 기록', to: RECORDS_PATH },
  { label: '인프라 지도', to: '/map' },
  { label: '동네 찾기', to: '/neighborhoods' },
  { label: '체크리스트', to: '/checklists' },
  { label: '방 비교', to: '/compare' },
] as const;

type DesktopHeaderProps = {
  className?: string;
};

/**
 * 데스크탑 화면 공통 헤더. 왼쪽 위 로고로 홈에 가고(로고 옆에 화면 이름은 두지 않는다), 가운데에는 화면별 요소(검색창 등)를,
 * 오른쪽 메뉴로 주요 화면을 바로 옮겨 다니며,
 * 맨 오른쪽 프로필로 마이페이지에 간다. 홈 헤더와 로고·프로필 위치를 맞춘다.
 */
const DesktopHeader = ({ className }: DesktopHeaderProps) => {
  const registerSlot = useRegisterDesktopHeaderSlot();

  return (
    <header className={`${styles.header} ${className ?? ''}`.trim()}>
      <Link className={styles.homeLogo} to={HOME_PATH} aria-label="홈으로 돌아가기">
        <img src={logo} width={160} height={160} alt="" />
      </Link>
      {/* 지도 화면의 검색창처럼 화면마다 헤더 가운데에 두는 요소가 들어오는 자리. */}
      <div ref={registerSlot} className={styles.slot} />
      <nav className={styles.nav} aria-label="주요 화면">
        {DESKTOP_NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Link className={styles.profile} to="/me" aria-label="마이페이지">
        <img src={iconProfile} alt="" width={96} height={96} />
      </Link>
    </header>
  );
};

export default DesktopHeader;
