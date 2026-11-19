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
import LandingGetStarted from '../ui/LandingGetStarted';
import LandingTech from '../ui/LandingTech';
import LandingWhy from '../ui/LandingWhy';

const { src: logo, src2x: logo2x } = LOGO_DUCK;

type LandingDesktopPageProps = {
  search: string;
  /** 서비스 안에서 들어왔을 때 돌아갈 주소 */
  returnTo?: string;
};

/** 데스크탑 랜딩. 왼쪽 글과 오른쪽 영상으로 시작해, 아래로 운영 화면을 한 스크롤에 하나씩 보여준다. */
const LandingDesktopPage = ({ search, returnTo }: LandingDesktopPageProps) => (
  <main className={styles.page}>
    <section className={styles.screen} aria-labelledby="landing-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.brand}>
            <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} width={32} height={32} alt="" />
            자취선배
          </p>
          <h1 id="landing-title">
            {HERO_TITLE[0]}
            <br />
            {HERO_TITLE[1]}
          </h1>
          <p className={styles.heroLead}>{HERO_LEAD}</p>
          <LandingGetStarted search={search} returnTo={returnTo} position="top" layout="row" />
        </div>
        <figure className={styles.heroVideo}>
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
          />
        </figure>
      </div>
    </section>

    {STORIES.map((story, index) => (
      <section
        key={story.id}
        className={`${styles.screen} ${styles.compact} ${index % 2 === 1 ? styles.tinted : ''}`}
        aria-labelledby={`landing-${story.id}-title`}
      >
        <div className={`${styles.story} ${index % 2 === 1 ? styles.reversed : ''}`}>
          <div className={styles.storyCopy}>
            <h2
              id={`landing-${story.id}-title`}
              style={{ '--landing-tone': STORY_TONE_COLOR[story.tone] } as CSSProperties}
              className={styles.toned}
            >
              {story.title}
            </h2>
            <p className={styles.storyDescription}>{story.description}</p>
            <ul className={styles.points}>
              {story.points.map((point) => (
                <li key={point.strong}>
                  {point.lead}
                  <b>{point.strong}</b>
                  {point.tail}
                </li>
              ))}
            </ul>
          </div>
          <figure className={styles.browser}>
            <div className={styles.browserBar} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <img src={story.screen} width={1440} height={900} alt={story.screenAlt} loading="lazy" />
          </figure>
        </div>
      </section>
    ))}

    <section className={`${styles.screen} ${styles.compact} ${styles.tinted}`} aria-labelledby="landing-why-title">
      <div className={styles.tech}>
        <h2
          id="landing-why-title"
          style={{ '--landing-tone': STORY_TONE_COLOR.neighborhood } as CSSProperties}
          className={styles.toned}
        >
          왜 만들었냐면
        </h2>
        <p className={styles.storyDescription}>{WHY_LEAD}</p>
        <LandingWhy layout="row" />
      </div>
    </section>

    <section className={`${styles.screen} ${styles.compact}`} aria-labelledby="landing-tech-title">
      <div className={styles.tech}>
        <h2
          id="landing-tech-title"
          style={{ '--landing-tone': STORY_TONE_COLOR.tech } as CSSProperties}
          className={styles.toned}
        >
          속도랑 정확도
        </h2>
        <p className={styles.storyDescription}>{TECH_LEAD}</p>
        <LandingTech layout="side" />
      </div>
    </section>

    <section
      className={`${styles.screen} ${styles.compact} ${styles.tinted} ${styles.closing}`}
      aria-labelledby="landing-closing-title"
    >
      <h2 id="landing-closing-title">
        {CLOSING_TITLE[0]} {CLOSING_TITLE[1]}
      </h2>
      <p className={styles.closingLead}>{CLOSING_LEAD}</p>
      <LandingGetStarted search={search} returnTo={returnTo} position="bottom" layout="row" />
      <p className={styles.footer}>우아한테크코스 8기 팀 프로젝트</p>
    </section>
  </main>
);

const styles = {
  /* 제목 왼쪽 색 막대로 동네 찾기(파랑), 본 방 기록(노랑), 만든 이야기를 구분한다. */
  toned: css`
    label: LandingDesktopPage-toned;
    padding-left: 1.125rem;
    border-left: 0.3125rem solid var(--landing-tone);
  `,

  page: css`
    label: LandingDesktopPage-page;
    min-height: 100%;
    background: var(--color-canvas);
    color: var(--color-ink);
  `,

  /* 한 스크롤에 한 이야기가 들어가도록 섹션마다 화면 높이를 채운다. */
  screen: css`
    label: LandingDesktopPage-screen;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 100vh;
    padding: 5rem 4rem;
  `,

  /* 첫 화면 아래 섹션은 화면 높이를 다 채우지 않아 섹션 사이 빈 공간이 줄어든다. */
  compact: css`
    label: LandingDesktopPage-compact;
    min-height: auto;
    padding-block: 3.5rem;
  `,

  tinted: css`
    label: LandingDesktopPage-tinted;
    background: var(--color-surface-muted);
  `,

  /*
   * 16:9 영상은 같은 폭이면 5:4보다 낮아 글자가 작게 보이므로 영상 칸을 넓힌다.
   * 글 칸은 1440px 화면에서 버튼 세 개가 한 줄에 들어가는 폭(약 34rem)을 남긴다.
   */
  heroInner: css`
    label: LandingDesktopPage-heroInner;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    align-items: center;
    gap: 3.5rem;
    width: min(100%, 88rem);
    margin: 0 auto;
  `,

  heroCopy: css`
    label: LandingDesktopPage-heroCopy;

    & h1 {
      margin: 1.75rem 0 1.25rem;
      font-size: 3.25rem;
      font-weight: 800;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }
  `,

  brand: css`
    label: LandingDesktopPage-brand;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1.125rem;
    font-weight: 800;
  `,

  heroLead: css`
    label: LandingDesktopPage-heroLead;
    max-width: 30rem;
    margin: 0 0 2.5rem;
    color: var(--color-ink-soft);
    font-size: 1.125rem;
    line-height: 1.65;
    word-break: keep-all;
  `,

  heroVideo: css`
    label: LandingDesktopPage-heroVideo;
    margin: 0;
    overflow: hidden;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-app-shell);

    & video {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: ${VIDEO_SIZE.width} / ${VIDEO_SIZE.height};
      object-fit: cover;
    }
  `,

  story: css`
    label: LandingDesktopPage-story;
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.6fr);
    align-items: center;
    gap: 4rem;
    width: min(100%, 80rem);
    margin: 0 auto;
  `,

  /* 이야기마다 글과 화면의 좌우를 바꿔 스크롤할 때 시선이 지그재그로 움직이게 한다. */
  reversed: css`
    label: LandingDesktopPage-reversed;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 0.8fr);

    & > :first-child {
      order: 2;
    }
  `,

  storyCopy: css`
    label: LandingDesktopPage-storyCopy;

    & h2 {
      margin: 0 0 1.25rem;
      font-size: 2.25rem;
      font-weight: 800;
      line-height: 1.3;
      letter-spacing: -0.02em;
      word-break: keep-all;
      text-wrap: balance;
    }
  `,

  storyDescription: css`
    label: LandingDesktopPage-storyDescription;
    margin: 0 0 1.75rem;
    color: var(--color-ink-soft);
    font-size: 1.05rem;
    line-height: 1.7;
    word-break: keep-all;
  `,

  points: css`
    label: LandingDesktopPage-points;
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;

    & li {
      position: relative;
      padding-left: 1.125rem;
      color: var(--color-ink-soft);
      font-size: 1rem;
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

  browser: css`
    label: LandingDesktopPage-browser;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-app-shell);

    & img {
      display: block;
      width: 100%;
      height: auto;
    }
  `,

  browserBar: css`
    label: LandingDesktopPage-browserBar;
    display: flex;
    gap: 0.375rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);

    & span {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 50%;
      background: var(--color-border-strong);
    }
  `,

  tech: css`
    label: LandingDesktopPage-tech;
    width: min(100%, 64rem);
    margin: 0 auto;

    & h2 {
      margin: 0 0 1.25rem;
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
  `,

  closing: css`
    label: LandingDesktopPage-closing;
    align-items: center;
    text-align: center;

    & h2 {
      margin: 0 0 1rem;
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
  `,

  closingLead: css`
    label: LandingDesktopPage-closingLead;
    margin: 0 0 2rem;
    color: var(--color-ink-soft);
    font-size: 1.125rem;
    line-height: 1.6;
  `,

  footer: css`
    label: LandingDesktopPage-footer;
    margin: 4rem 0 0;
    color: var(--color-muted);
    font-size: 0.8rem;
  `,
};

export default LandingDesktopPage;
