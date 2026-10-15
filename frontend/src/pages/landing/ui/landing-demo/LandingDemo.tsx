import { useEffect, useRef, useState } from 'react';

import mascotImage from '@/shared/assets/empty-property.jpg';

import { trackLandingDemoInteraction } from '../../lib/landingAnalytics';

import styles from './LandingDemo.module.css';

const STEPS = ['동네 찾기', '방 등록', '정보 저장', '체크리스트'];
const CAPTIONS = [
  '자주 가는 곳 주변을 통근 시간이나 월세 평균가로 살펴봐요.',
  '보러 갈 방의 이름과 가격을 적어요.',
  '방 정보와 사진을 한곳에 저장해요.',
  '현장에서 확인한 내용을 체크해요.',
];
const SAMPLE_NAME = '학교 앞 원룸';
const TICKS_PER_STEP = 35;

/** 서버에 저장하지 않는 가상 사용 예시. 화면이 보일 때만 재생한다. */
const LandingDemo = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<'commute' | 'price'>('commute');
  const [isPaused, setIsPaused] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  const [isVisible, setIsVisible] = useState(true);
  const stage = Math.floor(tick / TICKS_PER_STEP);
  const progress = tick % TICKS_PER_STEP;
  const typedName = SAMPLE_NAME.slice(0, Math.floor(progress / 2));

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (query?.matches) setIsPaused(true);
    };
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry?.isIntersecting === true), {
      threshold: 0.2,
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (isPaused || !isVisible) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setTick((value) => (value + 1) % (STEPS.length * TICKS_PER_STEP));
    }, 100);
    return () => window.clearInterval(timer);
  }, [isPaused, isVisible]);

  const selectStep = (index: number) => {
    setTick(index * TICKS_PER_STEP + 28);
    setIsPaused(true);
  };

  return (
    <section ref={sectionRef} className={styles.demo} aria-labelledby="usage-heading">
      <h2 id="usage-heading">이렇게 사용해요</h2>
      <div className={styles.steps} aria-label="사용 예시 단계">
        {STEPS.map((step, index) => (
          <button
            key={step}
            type="button"
            aria-pressed={stage === index}
            onClick={() => {
              trackLandingDemoInteraction('step', String(index + 1));
              selectStep(index);
            }}
          >
            <span>{index + 1}</span>
            {step}
          </button>
        ))}
      </div>
      <div className={styles.screen} data-stage={stage} data-paused={isPaused}>
        <div className={styles.toolbar}>
          <img src={mascotImage} width={22} height={22} alt="" />
          <strong>자취선배</strong>
          <small>예시 화면</small>
        </div>
        <div className={styles.content} key={stage}>
          {stage === 0 ? (
            <>
              <h3>자취할 동네 찾기</h3>
              <div className={styles.mapSearch}>⌕ {progress > 6 ? '판교역' : '학교·회사 등 자주 가는 곳 검색'}</div>
              <div className={styles.mapFilters} aria-label="동네 탐색 기준">
                <button
                  type="button"
                  aria-pressed={mode === 'commute'}
                  onClick={() => {
                    trackLandingDemoInteraction('mode', 'commute');
                    setMode('commute');
                    selectStep(0);
                  }}
                >
                  통근 시간
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'price'}
                  onClick={() => {
                    trackLandingDemoInteraction('mode', 'price');
                    setMode('price');
                    selectStep(0);
                  }}
                >
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
          ) : stage === 1 ? (
            <>
              <h3>매물 추가</h3>
              <div className={styles.field}>
                <span>매물 이름</span>
                <strong>
                  {typedName || '보러 갈 방 이름'}
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
          ) : stage === 2 ? (
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
          ) : (
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
        </div>
        <span className={styles.cursor} aria-hidden="true">
          ↖
        </span>
      </div>
      <p className={styles.caption}>{CAPTIONS[stage]}</p>
      <button
        className={styles.playbackControl}
        type="button"
        onClick={() => {
          trackLandingDemoInteraction('playback', isPaused ? 'play' : 'pause');
          setIsPaused((value) => !value);
        }}
      >
        {isPaused ? '시연 재생' : '일시정지'}
      </button>
    </section>
  );
};

export default LandingDemo;
