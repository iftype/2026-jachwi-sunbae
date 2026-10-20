import { Link } from 'react-router-dom';

import styles from './HomeFooter.module.css';

const FOOTER_LINKS = [
  { label: '서비스 소개', to: '/about' },
  { label: '개인정보·광고 측정 안내', to: '/privacy' },
];

/** 홈 맨 아래 푸터. 한 줄 소개와 안내 링크, 저작권 표기를 둔다. */
type HomeFooterProps = {
  className?: string;
  /** 켜면 넓은 화면처럼 왼쪽 정렬하고 위 여백을 넓힌다(데스크탑). */
  alignStart?: boolean;
};

const HomeFooter = ({ className, alignStart = false }: HomeFooterProps) => (
  <footer className={`${styles.footer} ${className ?? ''}`.trim()} data-align-start={alignStart || undefined}>
    <p className={styles.slogan}>본 방의 기록이, 내 방을 고르는 기준이 되도록.</p>
    <nav className={styles.links} aria-label="서비스 안내">
      {FOOTER_LINKS.map((link) => (
        <Link key={link.to} to={link.to}>
          {link.label}
        </Link>
      ))}
    </nav>
    <small className={styles.copyright}>© 2026 자취선배</small>
  </footer>
);

export default HomeFooter;
