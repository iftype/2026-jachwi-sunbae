import { css, cx } from '@emotion/css';
import { Link } from 'react-router-dom';

import {
  HOME_PATH,
  LANDING_PATH,
  type LandingEntryState,
  landingEntryState,
  PRIVACY_PATH,
} from '@/shared/lib/navigation/appPaths';

/** 서비스 소개(랜딩)는 돌아가기 버튼이 홈으로 오게 진입 위치를 함께 넘긴다. 사용 방법은 마이페이지에 둔다. */
const FOOTER_LINKS: { label: string; to: string; state?: LandingEntryState }[] = [
  { label: '자취선배 소개', to: LANDING_PATH, state: landingEntryState('home_footer', HOME_PATH) },
  { label: '개인정보·광고 측정 안내', to: PRIVACY_PATH },
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
        <Link key={link.to} to={link.to} state={link.state}>
          {link.label}
        </Link>
      ))}
    </nav>
    <small className={styles.copyright}>© 2026 자취선배</small>
  </footer>
);

const styles = {
  // 다른 요소의 선택자에서 `.HomeFooter-footer`로 가리킨다.
  footer: cx(
    css`
      label: HomeFooter-footer;
      display: grid;
      justify-items: center;
      gap: 0.6rem;
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
      border-top: 1px solid var(--color-border);
      color: var(--color-placeholder);
      font-size: 0.7rem;
      line-height: 1.5;
      text-align: center;

      /* 데스크탑에서는 본문 왼쪽 끝에 맞춰 왼쪽 정렬한다. */
      /* 데스크탑 홈에서는 왼쪽 정렬하고 위 여백을 넓힌다. */
      &[data-align-start='true'] {
        justify-items: start;
        margin-top: 4rem;
        padding-top: 2rem;
        text-align: left;
      }
    `,
    'HomeFooter-footer',
  ),

  slogan: css`
    label: HomeFooter-slogan;
    margin: 0;
    color: var(--color-muted);
  `,

  links: css`
    label: HomeFooter-links;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem 1rem;

    & a {
      border-radius: 0.25rem;
      color: var(--color-muted);
      text-decoration: none;
    }

    & a:hover {
      color: var(--color-ink);
      text-decoration: underline;
      text-underline-offset: 0.15rem;
    }

    & a:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }

    .HomeFooter-footer[data-align-start='true'] & {
      justify-content: flex-start;
    }
  `,

  copyright: css`
    label: HomeFooter-copyright;
    font-size: inherit;
  `,
};

export default HomeFooter;
