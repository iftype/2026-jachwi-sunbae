import { useLayoutEffect, useRef, useState } from 'react';

import appStoreBadge from '@/shared/assets/app-store-badge.png';
import mascotImage from '@/shared/assets/empty-property.jpg';
import mapImage from '@/shared/assets/landing/instagram-map.jpg';
import propertyDetailImage from '@/shared/assets/landing/instagram-property-detail.jpg';
import propertyExtraImage from '@/shared/assets/landing/instagram-property-extra.jpg';
import propertyListImage from '@/shared/assets/landing/instagram-property-list.jpg';

import { trackLandingCta } from './lib/landingAnalytics';

import styles from './LandingPage.module.css';

const APP_STORE_URL = 'https://apps.apple.com/us/app/%EC%9E%90%EC%B7%A8%EC%84%A0%EB%B0%B0/id6816321229';
const WEB_LOGIN_URL = 'https://www.jachwi-sunbae.kr/login';
const screens = [
  { src: propertyListImage, label: '매물 모아보기', alt: '최근 담은 매물 목록' },
  { src: propertyDetailImage, label: '매물 기록', alt: '매물 기본 정보와 사진' },
  { src: propertyExtraImage, label: '옵션 확인', alt: '관리비와 방 옵션 입력' },
  { src: mapImage, label: '지도에서 등록', alt: '지도에서 매물 주소 선택' },
];
const loopingScreens = [screens[screens.length - 1], ...screens, screens[0]];

const LandingPage = () => {
  const railRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const isMovingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (rail === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (rail.clientWidth === 0) return;
      const position = Math.round(rail.scrollLeft / rail.clientWidth);
      const index = (position - 1 + screens.length) % screens.length;
      activeIndexRef.current = index;
      setActiveIndex(index);
      if (position === 0 || position === screens.length + 1) {
        rail.scrollTo({ left: (index + 1) * rail.clientWidth, behavior: 'instant' });
      }
      isMovingRef.current = false;
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 160);
    };
    const resize = new ResizeObserver(() => {
      clearTimeout(timer);
      rail.scrollTo({ left: (activeIndexRef.current + 1) * rail.clientWidth, behavior: 'instant' });
      isMovingRef.current = false;
    });
    rail.scrollTo({ left: rail.clientWidth, behavior: 'instant' });
    rail.addEventListener('scroll', onScroll, { passive: true });
    resize.observe(rail);
    return () => {
      clearTimeout(timer);
      resize.disconnect();
      rail.removeEventListener('scroll', onScroll);
    };
  }, []);

  const showScreen = (index: number) => {
    const rail = railRef.current;
    if (rail === null || isMovingRef.current || index === activeIndexRef.current) return;
    isMovingRef.current = true;
    rail.scrollTo({
      left: rail.clientWidth * (index + 1),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="landing-heading">
        <a
          className={styles.brand}
          href={isIOS ? APP_STORE_URL : WEB_LOGIN_URL}
          onClick={() => trackLandingCta(isIOS ? 'app_store' : 'web', 'brand')}
          aria-label={isIOS ? '자취선배 앱 다운로드' : '자취선배 웹 시작하기'}
        >
          <img src={mascotImage} alt="자취선배 오리 로고" width={36} height={36} />
          <h1 id="landing-heading">자취선배</h1>
          <p>보러 간 방, 한곳에 기록.</p>
        </a>
        <div className={styles.preview}>
          <div className={styles.rail} ref={railRef} role="region" aria-label="앱 화면 미리보기" tabIndex={0}>
            {loopingScreens.map((screen, index) => (
              <figure
                className={styles.slide}
                key={`${screen.src}-${index}`}
                aria-hidden={index === 0 || index === screens.length + 1}
                aria-label={`${index} / ${screens.length}`}
              >
                <div className={styles.imageFrame}>
                  <img src={screen.src} alt={screen.alt} />
                  <button
                    className={styles.imagePrevious}
                    type="button"
                    aria-label="사진 왼쪽: 이전 화면"
                    tabIndex={index === activeIndex + 1 ? 0 : -1}
                    onClick={() => showScreen(activeIndex - 1)}
                  />
                  <button
                    className={styles.imageNext}
                    type="button"
                    aria-label="사진 오른쪽: 다음 화면"
                    tabIndex={index === activeIndex + 1 ? 0 : -1}
                    onClick={() => showScreen(activeIndex + 1)}
                  />
                </div>
                <figcaption>{screen.label}</figcaption>
              </figure>
            ))}
          </div>
          <div className={styles.controls}>
            <button type="button" aria-label="이전 화면" onClick={() => showScreen(activeIndex - 1)}>
              ‹
            </button>
            <div className={styles.dots}>
              {screens.map((screen, index) => (
                <button
                  key={screen.src}
                  type="button"
                  aria-label={`${index + 1}번 화면: ${screen.label}`}
                  aria-pressed={activeIndex === index}
                  onClick={() => showScreen(index)}
                >
                  <span />
                </button>
              ))}
            </div>
            <button type="button" aria-label="다음 화면" onClick={() => showScreen(activeIndex + 1)}>
              ›
            </button>
          </div>
        </div>
        <nav className={styles.actions} aria-label="자취선배 시작하기">
          <a
            className={styles.appButton}
            href={APP_STORE_URL}
            onClick={() => trackLandingCta('app_store', 'actions')}
            aria-label="App Store에서 자취선배 다운로드"
          >
            <img src={appStoreBadge} alt="App Store에서 다운로드하기" />
          </a>
          <a className={styles.webButton} href={WEB_LOGIN_URL} onClick={() => trackLandingCta('web', 'actions')}>
            <span>
              <small>설치 없이</small>
              <strong>웹에서 시작</strong>
            </span>
          </a>
        </nav>
      </section>
    </main>
  );
};

export default LandingPage;
