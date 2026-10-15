import { useEffect } from 'react';

import { enterDesignShell } from '@/shared/lib/navigation/designShell';
import ActionCard, { ActionCardIllustration } from '@/shared/ui/action-card/ActionCard';

import cardInfrastructure from './assets/card-infrastructure.webp';
import cardNeighborhood from './assets/card-neighborhood.webp';
import guideGoose from './assets/guide-goose.webp';
import HomeHeader from './ui/HomeHeader';
import QuickMenu from './ui/QuickMenu';
import RecentRooms from './ui/RecentRooms';
import RecordCard from './ui/RecordCard';

import styles from './DesignHomePage.module.css';

const DesignHomePage = () => {
  useEffect(enterDesignShell, []);
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <HomeHeader />
        <p className={styles.tip}>계약 전, 놓친 문제는 없는지 확인해보세요.</p>
        <section className={styles.features} aria-label="자취선배 주요 기능">
          <div className={`${styles.column} ${styles.leftColumn}`}>
            <RecordCard className={styles.fill} />
          </div>
          <div className={`${styles.column} ${styles.rightColumn}`}>
            {/* 사용방법 화면은 이후 연결한다. */}
            <ActionCard
              tone="informative"
              title={
                <>
                  사용방법
                  <br />
                  알아보기
                </>
              }
              aria-label="사용방법 알아보기"
              className={styles.guide}
              illustration={<ActionCardIllustration src={guideGoose} width={200} height={294} placement="peek" />}
            />
            <ActionCard
              title="인프라 지도"
              description="주변 교통·편의시설을 살펴봐요"
              aria-label="인프라 보는 지도"
              to="/map"
              className={styles.fill}
              illustration={<ActionCardIllustration src={cardInfrastructure} width={320} height={320} />}
            />
            <ActionCard
              title="동네 찾기"
              description="통근 시간 · 월세 평균"
              aria-label="동네 정보 찾기"
              to="/neighborhoods"
              className={styles.fill}
              illustration={<ActionCardIllustration src={cardNeighborhood} width={320} height={320} />}
            />
          </div>
        </section>
        <QuickMenu />
        <RecentRooms />
        <footer className={styles.footer}>
          <span>본 방의 기록이, 내 방을 고르는 기준이 되도록.</span>
        </footer>
      </div>
    </main>
  );
};

export default DesignHomePage;
