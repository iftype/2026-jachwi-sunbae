import { Link } from 'react-router-dom';

import iconProfile from '@/shared/assets/icon-profile.webp';
import logo from '@/shared/assets/jachwi-sunbae-goose.webp';

import styles from './HomeHeader.module.css';

const HomeHeader = ({ className }: { className?: string }) => {
  return (
    <header className={`${styles.header} ${className ?? ''}`.trim()}>
      {/* 라우터 이동이 아닌 일반 링크로 두어 로고를 누르면 홈을 새로 불러온다. */}
      <a className={styles.home} href="/" aria-label="자취선배 홈 새로고침">
        <img className={styles.logo} src={logo} width={160} height={160} alt="자취선배" />
      </a>
      <Link className={styles.profile} to="/me" aria-label="마이페이지">
        <img src={iconProfile} alt="" width={96} height={96} />
      </Link>
    </header>
  );
};

export default HomeHeader;
