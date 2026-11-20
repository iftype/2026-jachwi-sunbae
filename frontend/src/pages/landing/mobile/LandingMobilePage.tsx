import { css } from '@emotion/css';
import type { CSSProperties } from 'react';

import { LOGO_DUCK } from '@/shared/assets/imageAssets';

import introVideo from '../assets/landing-intro.mp4';
import introPoster from '../assets/landing-intro-poster.webp';
import {
  CLOSING_LEAD,
  CLOSING_TITLE,
  HERO_LEAD,
  HERO_TITLE,
  STORIES,
  STORY_TONE_COLOR,
  TECH_LEAD,
  VIDEO_LABEL,
  VIDEO_SIZE,
  WHY_LEAD,
} from '../model/landingContent';
import { openVideoFullscreen } from '../model/openVideoFullscreen';
import LandingGetStarted from '../ui/LandingGetStarted';
import LandingTech from '../ui/LandingTech';
import LandingWhy from '../ui/LandingWhy';

const { src: logo, src2x: logo2x } = LOGO_DUCK;

type LandingMobilePageProps = {
  search: string;
  /** 서비스 안에서 들어왔을 때 돌아갈 주소 */
  returnTo?: string;
};

/** 휴대폰 랜딩. 글, 버튼, 영상을 위에서부터 쌓고, 기능마다 휴대폰으로 찍은 운영 화면을 보여준다. */
const LandingMobilePage = ({ search, returnTo }: LandingMobilePageProps) => (
  <main className={styles.page}>
    <section className={styles.hero} aria-labelledby="landing-title">
      <p className={styles.brand}>
        <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} width={28} height={28} alt="" />
        자취선배
      </p>
      <h1 id="landing-title">
        {HERO_TITLE[0]}
        <br />
        {HERO_TITLE[1]}
      </h1>
      <p className={styles.lead}>{HERO_LEAD}</p>
      <LandingGetStarted search={search} returnTo={returnTo} position="top" layout="stack" />
      <figure className={styles.video}>
        <video
          src={introVideo}
          poster={introPoster}
          width={VIDEO_SIZE.width}
          height={VIDEO_SIZE.height}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={VIDEO_LABEL}
          title="누르면 전체 화면으로 봐요"
          onClick={(event) => openVideoFullscreen(event.currentTarget)}
        />
      </figure>
    </section>

    {STORIES.map((story, index) => (
      <section
        key={story.id}
        className={`${styles.section} ${index % 2 === 0 ? styles.tinted : ''}`}
        aria-labelledby={`landing-${story.id}-title`}
      >
        <h2
          id={`landing-${story.id}-title`}
          style={{ '--landing-tone': STORY_TONE_COLOR[story.tone] } as CSSProperties}
          className={`${styles.title} ${styles.toned}`}
        >
          {story.title}
        </h2>
        <p className={styles.description}>{story.description}</p>
        <ul className={styles.points}>
          {story.points.map((point) => (
            <li key={point.strong}>
              {point.lead}
              <b>{point.strong}</b>
              {point.tail}
            </li>
          ))}
        </ul>
        <figure className={styles.phone}>
          <img src={story.mobileScreen} width={780} height={1688} alt={story.screenAlt} loading="lazy" />
        </figure>
      </section>
    ))}

    <section className={`${styles.section} ${styles.tinted}`} aria-labelledby="landing-why-title">
      <h2
        id="landing-why-title"
        style={{ '--landing-tone': STORY_TONE_COLOR.neighborhood } as CSSProperties}
        className={`${styles.title} ${styles.toned}`}
      >
        왜 만들었냐면
      </h2>
      <p className={styles.description}>{WHY_LEAD}</p>
      <LandingWhy layout="stack" />
    </section>

    <section className={styles.section} aria-labelledby="landing-tech-title">
      <h2
        id="landing-tech-title"
        style={{ '--landing-tone': STORY_TONE_COLOR.tech } as CSSProperties}
        className={`${styles.title} ${styles.toned}`}
      >
        속도랑 정확도
      </h2>
      <p className={styles.description}>{TECH_LEAD}</p>
      <LandingTech layout="stack" />
    </section>

    <section className={`${styles.section} ${styles.tinted} ${styles.closing}`} aria-labelledby="landing-closing-title">
      <h2 id="landing-closing-title" className={styles.title}>
        {CLOSING_TITLE[0]}
        <br />
        {CLOSING_TITLE[1]}
      </h2>
      <p className={styles.closingLead}>{CLOSING_LEAD}</p>
      <LandingGetStarted search={search} returnTo={returnTo} position="bottom" layout="stack" />
      <p className={styles.footer}>우아한테크코스 8기 팀 프로젝트</p>
    </section>
  </main>
);

const styles = {
  /* 제목 왼쪽 색 막대로 동네 찾기(파랑), 본 방 기록(노랑), 만든 이야기를 구분한다. */
  toned: css`
    label: LandingMobilePage-toned;
    padding-left: 0.875rem;
    border-left: 0.25rem solid var(--landing-tone);
  `,

  page: css`
    label: LandingMobilePage-page;
    min-height: 100%;
    background: var(--color-canvas);
    color: var(--color-ink);
  `,

  hero: css`
    label: LandingMobilePage-hero;
    padding: 2.5rem var(--page-inline-padding) 3rem;

    & h1 {
      margin: 1.25rem 0 0.875rem;
      font-size: 1.875rem;
      font-weight: 800;
      line-height: 1.3;
      letter-spacing: -0.02em;
    }
  `,

  brand: css`
    label: LandingMobilePage-brand;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
  `,

  lead: css`
    label: LandingMobilePage-lead;
    margin: 0 0 1.75rem;
    color: var(--color-ink-soft);
    font-size: 0.95rem;
    line-height: 1.6;
    word-break: keep-all;
  `,

  video: css`
    label: LandingMobilePage-video;
    margin: 2rem 0 0;
    overflow: hidden;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-app-shell);

    & video {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: ${VIDEO_SIZE.width} / ${VIDEO_SIZE.height};
      object-fit: cover;
      cursor: zoom-in;

      &:fullscreen {
        object-fit: contain;
        background: #fff;
        cursor: auto;
      }
    }
  `,

  section: css`
    label: LandingMobilePage-section;
    padding: 3.5rem var(--page-inline-padding);
  `,

  tinted: css`
    label: LandingMobilePage-tinted;
    background: var(--color-surface-muted);
  `,

  title: css`
    label: LandingMobilePage-title;
    margin: 0 0 0.875rem;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.35;
    letter-spacing: -0.02em;
    word-break: keep-all;
    text-wrap: balance;
  `,

  description: css`
    label: LandingMobilePage-description;
    margin: 0 0 1.25rem;
    color: var(--color-ink-soft);
    font-size: 0.95rem;
    line-height: 1.65;
    word-break: keep-all;
  `,

  points: css`
    label: LandingMobilePage-points;
    display: grid;
    gap: 0.5rem;
    margin: 0 0 2rem;
    padding: 0;
    list-style: none;

    & li {
      position: relative;
      padding-left: 1.125rem;
      color: var(--color-ink-soft);
      font-size: 0.9rem;
      line-height: 1.5;
      word-break: keep-all;
    }

    & li::before {
      position: absolute;
      top: 0.55em;
      left: 0.125rem;
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 50%;
      background: var(--color-border-strong);
      content: '';
    }

    & b {
      color: var(--color-ink);
      font-weight: 700;
    }
  `,

  /* 휴대폰 캡처는 폰 테두리 안에 넣어, 랜딩 자체 화면과 구분되게 한다. */
  phone: css`
    label: LandingMobilePage-phone;
    width: min(72%, 16rem);
    margin: 0 auto;
    overflow: hidden;
    border: 0.375rem solid var(--color-ink);
    border-radius: 2rem;
    background: var(--color-surface);
    box-shadow: var(--shadow-app-shell);

    & img {
      display: block;
      width: 100%;
      height: auto;
    }
  `,

  closing: css`
    label: LandingMobilePage-closing;
    text-align: center;

    & h2 {
      margin-bottom: 0.75rem;
    }
  `,

  closingLead: css`
    label: LandingMobilePage-closingLead;
    margin: 0 0 1.5rem;
    color: var(--color-ink-soft);
    font-size: 0.95rem;
    line-height: 1.6;
  `,

  footer: css`
    label: LandingMobilePage-footer;
    margin: 2.5rem 0 0;
    color: var(--color-muted);
    font-size: 0.75rem;
  `,
};

export default LandingMobilePage;
