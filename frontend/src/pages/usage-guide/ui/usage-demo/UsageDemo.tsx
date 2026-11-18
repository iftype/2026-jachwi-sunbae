import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { CHECKLISTS_PATH, NEIGHBORHOODS_PATH, RECORDS_MAP_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

import checklistVideo from '../../assets/guide-checklist.mp4';
import checklistPoster from '../../assets/guide-checklist-poster.jpg';
import exploreVideo from '../../assets/guide-explore.mp4';
import explorePoster from '../../assets/guide-explore-poster.jpg';
import memoVideo from '../../assets/guide-memo.mp4';
import memoPoster from '../../assets/guide-memo-poster.jpg';
import propertyVideo from '../../assets/guide-property.mp4';
import propertyPoster from '../../assets/guide-property-poster.jpg';

type Scenario = {
  title: string;
  steps: string[];
  action: { to: string; label: string };
  video: { src: string; poster: string; label: string };
};

/** 집 구하는 순서대로 네 가지. 영상은 개발 서버에서 실제로 조작하며 녹화했다. */
const SCENARIOS: Scenario[] = [
  {
    title: '동네 찾기',
    steps: ['회사나 학교 검색', '통근 시간, 환승, 월세 고르기', '가까운 동네부터 확인'],
    action: { to: NEIGHBORHOODS_PATH, label: '동네 찾아보기' },
    video: {
      src: exploreVideo,
      poster: explorePoster,
      label: '판교역을 검색하고 통근 30분 이내로 고른 뒤 1위 동네를 여는 영상',
    },
  },
  {
    title: '거리 메모 남기기',
    steps: ['기록 지도에서 + 누르고 메모', '지도에서 자리 고르기', '좋아요, 싫어요와 한 줄 남기기'],
    action: { to: RECORDS_PATH, label: '기록 지도 열기' },
    video: {
      src: memoVideo,
      poster: memoPoster,
      label: '정자동 지도에서 자리를 골라 좋아요와 함께 거리 메모를 남기는 영상',
    },
  },
  {
    title: '매물 추가',
    steps: ['기록 지도에서 자리 누르기', '본 방 기록하기 고르기', '이름, 보증금, 월세 채우기'],
    action: { to: RECORDS_MAP_PATH, label: '기록 지도에서 등록하기' },
    video: {
      src: propertyVideo,
      poster: propertyPoster,
      label: '지도에서 자리를 골라 매물을 추가하고 이름과 보증금, 월세를 채우는 영상',
    },
  },
  {
    title: '체크리스트',
    steps: ['매물에서 체크리스트 탭', '항목마다 괜찮음, 주의', '필요하면 메모 추가'],
    action: { to: CHECKLISTS_PATH, label: '체크리스트 보기' },
    video: {
      src: checklistVideo,
      poster: checklistPoster,
      label: '체크리스트 항목에 괜찮음과 주의를 고르고 메모를 남기는 영상',
    },
  },
];

/**
 * 화면에 보일 때만 반복 재생한다. 움직임을 줄인 환경이나 감지가 안 되는 환경에서는 재생하지 않고
 * 마지막 장면(포스터)만 보여준다.
 */
const ScenarioVideo = ({ src, poster, label }: Scenario['video']) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (!video || reduceMotion || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.5 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.phone}>
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={label} />
    </div>
  );
};

/** 사용 방법을 실제로 쓰는 순서대로 짧게 보여주고, 시나리오마다 그 기능으로 바로 이어 준다. */
const UsageDemo = () => (
  <section className={styles.demo} aria-labelledby="usage-steps-heading">
    <h2 id="usage-steps-heading">이렇게 사용해요</h2>
    <ol className={styles.scenarios}>
      {SCENARIOS.map((scenario, index) => (
        <li key={scenario.title} className={styles.scenario}>
          <div className={styles.copy}>
            <h3 className={styles.title}>
              <span aria-hidden="true">{index + 1}</span>
              {scenario.title}
            </h3>
            <ol className={styles.steps}>
              {scenario.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Link className={styles.action} to={scenario.action.to}>
              {scenario.action.label}
              <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <ScenarioVideo {...scenario.video} />
        </li>
      ))}
    </ol>
  </section>
);

const styles = {
  demo: css`
    label: UsageDemo-demo;
    margin-bottom: 2rem;

    & > h2 {
      margin: 0 0 1.25rem;
      font-size: 0.95rem;
      letter-spacing: -0.02em;
    }
  `,

  /* 데스크탑은 시나리오를 두 열로 놓아, 한 줄에 설명과 영상이 멀리 떨어지지 않게 한다. */
  scenarios: css`
    label: UsageDemo-scenarios;
    display: grid;
    gap: 2.5rem;
    margin: 0;
    padding: 0;
    list-style: none;

    @media (min-width: 64rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.25rem;
    }
  `,

  /* 휴대폰은 설명 아래에 영상을, 넓은 화면은 설명 오른쪽에 영상을 둔다. 데스크탑은 칸마다 카드로 묶는다. */
  scenario: css`
    label: UsageDemo-scenario;
    display: grid;
    gap: 1rem;

    @media (min-width: 48rem) {
      grid-template-columns: minmax(0, 1fr) 13rem;
      align-items: center;
      gap: 2.5rem;
    }

    @media (min-width: 64rem) {
      grid-template-columns: minmax(0, 1fr) 8.5rem;
      align-items: start;
      gap: 1rem;
      padding: 1.25rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
  `,

  /* 데스크탑 카드는 설명 칸이 좁아, 단계 들여쓰기를 없애고 낱말 중간에서 줄을 나누지 않는다. */
  copy: css`
    label: UsageDemo-copy;
    min-width: 0;
    word-break: keep-all;

    @media (min-width: 64rem) {
      & > ol,
      & > a {
        margin-left: 0;
      }

      & > ol {
        font-size: 0.82rem;
      }
    }
  `,

  title: css`
    label: UsageDemo-title;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 800;

    & span {
      display: grid;
      flex: none;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 50%;
      background: var(--color-ink);
      color: var(--color-surface);
      font-size: 0.8rem;
      font-weight: 700;
      place-items: center;
    }
  `,

  /* 순서가 중요한 짧은 동작이라 화살표로 잇는다. */
  steps: css`
    label: UsageDemo-steps;
    display: grid;
    gap: 0.3rem;
    margin: 0.6rem 0 0 2.2rem;
    padding: 0;
    color: var(--color-ink-soft);
    font-size: 0.9rem;
    line-height: 1.5;
    list-style: none;

    & li::before {
      margin-right: 0.4rem;
      color: var(--color-muted);
      content: '→';
    }
  `,

  action: css`
    label: UsageDemo-action;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0.6rem 0 0 2.2rem;
    color: var(--color-ink);
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
      border-radius: 0.25rem;
    }

    @media (hover: hover) {
      &:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
  `,

  phone: css`
    label: UsageDemo-phone;
    width: min(100%, 13rem);
    margin: 0 auto;
    overflow: hidden;
    border: 0.3rem solid var(--color-ink);
    border-radius: 1.5rem;

    @media (min-width: 64rem) {
      border-width: 0.25rem;
      border-radius: 1.1rem;
    }

    background: var(--color-canvas);
    box-shadow: 0 8px 24px #0000000c;

    & video {
      display: block;
      width: 100%;
      aspect-ratio: 390 / 844;
      object-fit: cover;
    }
  `,
};

export default UsageDemo;
