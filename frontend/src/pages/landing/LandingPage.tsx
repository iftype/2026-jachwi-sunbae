import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

import mascotImage from '@/shared/assets/empty-property.jpg';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

import { trackLandingCta } from './lib/landingAnalytics';
import { getLandingMobilePlatform, LANDING_APP_URLS } from './lib/landingPlatform';
import LandingDemo from './ui/landing-demo/LandingDemo';

import styles from './LandingPage.module.css';

const LandingPage = () => {
  const isAbout = useLocation().pathname === '/about';
  const appPlatform = getLandingMobilePlatform(navigator.userAgent, navigator.maxTouchPoints);
  useEffect(() => {
    trackPostHogEvent(isAbout ? 'service_introduction_viewed' : 'landing_page_viewed');
  }, [isAbout]);
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="landing-heading">
        <div className={styles.appRecommendationSlot}>
          {appPlatform && (
            <aside className={styles.appRecommendation} aria-label="앱 이용 안내">
              <span>자취선배를 앱에서도 만나보세요</span>
              <a
                href={LANDING_APP_URLS[appPlatform]}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLandingCta(appPlatform === 'ios' ? 'app_store' : 'google_play', 'brand')}
              >
                앱으로 써보기
              </a>
            </aside>
          )}
        </div>
        <header className={styles.introduction}>
          <div className={styles.brand}>
            <img src={mascotImage} alt="" width={28} height={28} />
            <h1 id="landing-heading">자취선배</h1>
          </div>
          <p>자취할 동네를 찾고, 직접 본 방을 기록해요.</p>
        </header>
        <LandingDemo />
        <Link className={styles.webButton} to="/explore" onClick={() => trackLandingCta('web', 'actions')}>
          동네 찾아보기
        </Link>
      </section>
    </main>
  );
};
export default LandingPage;
