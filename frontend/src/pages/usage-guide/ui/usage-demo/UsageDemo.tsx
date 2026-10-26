import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import mascotImage from '@/shared/assets/empty-property.jpg';
import Icon from '@/shared/ui/icon/Icon';

import { trackUsageGuideDemoInteraction } from '../../lib/usageGuideAnalytics';

import styles from './UsageDemo.module.css';

const SAMPLE_NAME = '학교 앞 원룸';
const STEP_TICKS = 34;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** 단계가 화면에 들어오면 한 번 재생하고 마지막 장면에 멈춘다. */
const useRevealProgress = () => {
  const ref = useRef<HTMLElement>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? STEP_TICKS : 0));

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const isDone = progress >= STEP_TICKS;
  useEffect(() => {
    if (!isRevealed || isDone) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setProgress((value) => Math.min(value + 1, STEP_TICKS));
    }, 100);
    return () => window.clearInterval(timer);
  }, [isRevealed, isDone]);

  return { ref, isRevealed, progress };
};

type StepProps = {
  index: number;
  title: string;
  caption: string;
  action: { to: string; label: string };
  children: (progress: number) => ReactNode;
};

const DemoStep = ({ index, title, caption, action, children }: StepProps) => {
  const { ref, isRevealed, progress } = useRevealProgress();
  return (
    <article ref={ref} className={styles.step} data-revealed={isRevealed} aria-labelledby={`usage-step-${index}`}>
      <div className={styles.stepText}>
        <p className={styles.stepLabel}>
          <span>{index + 1}</span>
          <strong id={`usage-step-${index}`}>{title}</strong>
        </p>
        <p className={styles.caption}>{caption}</p>
        <Link className={styles.stepAction} to={action.to}>
          {action.label}
          <Icon name="arrow-right" size={14} />
        </Link>
      </div>
      <div className={styles.screen} data-stage={index}>
        <div className={styles.toolbar}>
          <img src={mascotImage} width={22} height={22} alt="" />
          <strong>자취선배</strong>
          <small>예시 화면</small>
        </div>
        <div className={styles.content}>{children(progress)}</div>
        <span className={styles.cursor} aria-hidden="true">
          ↖
        </span>
      </div>
    </article>
  );
};

/** 서버에 저장하지 않는 가상 사용 예시. 스크롤로 각 단계를 보여주고, 단계마다 실제 기능으로 이어 준다. */
const UsageDemo = () => {
  const [mode, setMode] = useState<'commute' | 'price'>('commute');
  const selectMode = (value: typeof mode) => {
    trackUsageGuideDemoInteraction('mode', value);
    setMode(value);
  };

  return (
    <section className={styles.demo} aria-labelledby="usage-steps-heading">
      <h2 id="usage-steps-heading">이렇게 사용해요</h2>
      <DemoStep
        index={0}
        title="동네 찾기"
        caption="자주 가는 곳 주변을 통근 시간이나 월세 평균가로 살펴봐요."
        action={{ to: '/neighborhoods', label: '동네 찾아보기' }}
      >
        {(progress) => (
          <>
            <h3>자취할 동네 찾기</h3>
            <div className={styles.mapSearch}>⌕ {progress > 6 ? '판교역' : '학교·회사 등 자주 가는 곳 검색'}</div>
            <div className={styles.mapFilters} aria-label="동네 탐색 기준">
              <button type="button" aria-pressed={mode === 'commute'} onClick={() => selectMode('commute')}>
                통근 시간
              </button>
              <button type="button" aria-pressed={mode === 'price'} onClick={() => selectMode('price')}>
                월세 평균가
              </button>
              <small>{mode === 'commute' ? '30분 이내 · 환승 1회' : '평균 월세 60만원 이하'}</small>
            </div>
            <div className={styles.mapPreview} aria-label="동네 찾기 예시 지도" data-ready={progress > 12}>
              <svg viewBox="0 0 320 150" aria-hidden="true">
                <path d="M0 100 Q65 60 150 105 T320 60" className={styles.river} />
                <path
                  d="M15 0 L85 150 M160 0 L135 150 M250 0 L210 150 M0 45 L320 35 M0 125 L320 110"
                  className={styles.roads}
                />
                <g className={styles.areas}>
                  <path d="M30 20 L105 15 L125 53 L98 85 L35 70 Z" fill="#168bff" />
                  <path d="M135 60 L205 40 L250 65 L232 120 L165 134 L130 105 Z" fill="#12bc67" />
                  <path d="M222 12 L290 8 L315 32 L300 78 L251 66 Z" fill="#ff4058" />
                </g>
              </svg>
              <span className={styles.destination}>📍 판교역</span>
              <div className={styles.mapLabels}>
                <span>
                  삼평동 <strong>{mode === 'commute' ? '10분' : '40만원'}</strong>
                </span>
                <span>
                  백현동 <strong>{mode === 'commute' ? '20분' : '50만원'}</strong>
                </span>
                <span>
                  이매동 <strong>{mode === 'commute' ? '30분' : '60만원'}</strong>
                </span>
              </div>
            </div>
          </>
        )}
      </DemoStep>
      <DemoStep
        index={1}
        title="방 등록"
        caption="보러 갈 방의 이름과 가격을 적어요."
        action={{ to: '/properties/new', label: '매물 등록하기' }}
      >
        {(progress) => (
          <>
            <h3>매물 추가</h3>
            <div className={styles.field}>
              <span>매물 이름</span>
              <strong>
                {SAMPLE_NAME.slice(0, Math.floor(progress / 2)) || '보러 갈 방 이름'}
                <i aria-hidden="true" />
              </strong>
            </div>
            <div className={styles.prices}>
              <div className={styles.field}>
                <span>보증금</span>
                <strong>{progress > 18 ? '1,000만원' : '—'}</strong>
              </div>
              <div className={styles.field}>
                <span>월세</span>
                <strong>{progress > 23 ? '55만원' : '—'}</strong>
              </div>
            </div>
            <div className={styles.save} data-active={progress > 28}>
              매물 저장
            </div>
          </>
        )}
      </DemoStep>
      <DemoStep
        index={2}
        title="정보 저장"
        caption="방 정보와 사진을 한곳에 저장해요."
        action={{ to: '/properties', label: '본 방 기록 보기' }}
      >
        {() => (
          <>
            <h3>학교 앞 원룸</h3>
            <div className={styles.photo}>
              <img src={mascotImage} alt="예시 매물 사진" />
              <span>방 사진도 함께 기록</span>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>보증금 / 월세</dt>
                <dd>1,000만원 / 55만원</dd>
              </div>
              <div>
                <dt>관리비</dt>
                <dd>8만원</dd>
              </div>
            </dl>
            <p className={styles.success}>✓ 매물을 저장했어요</p>
          </>
        )}
      </DemoStep>
      <DemoStep
        index={3}
        title="체크리스트"
        caption="현장에서 확인한 내용을 체크해요."
        action={{ to: '/checklists', label: '체크리스트 보기' }}
      >
        {(progress) => (
          <>
            <h3>현장 체크리스트</h3>
            <p className={styles.subtitle}>직접 보고, 놓치지 않게.</p>
            {['수압이 충분한가요?', '창문을 열어 환기할 수 있나요?', '벽에 곰팡이가 없나요?'].map((item, index) => (
              <div className={styles.check} key={item} data-checked={progress > index * 8 + 3}>
                <span>{progress > index * 8 + 3 ? '✓' : '○'}</span>
                {item}
              </div>
            ))}
            <p className={styles.success}>{[0, 1, 2].filter((index) => progress > index * 8 + 3).length} / 3 확인</p>
          </>
        )}
      </DemoStep>
    </section>
  );
};

export default UsageDemo;
