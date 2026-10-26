import ActionCard, { ActionCardIllustration } from '@/shared/ui/action-card/ActionCard';

import cardInfrastructure from '../assets/card-infrastructure.webp';
import cardNeighborhood from '../assets/card-neighborhood.webp';
import guideGoose from '../assets/guide-goose.webp';
import RecordCard from './RecordCard';

import styles from './HomeFeatures.module.css';

/** 홈의 주요 기능 카드: 왼쪽 큰 매물 기록 카드, 오른쪽 사용방법·인프라 지도·동네 찾기 카드. */
const HomeFeatures = ({ className }: { className?: string }) => (
  <section className={`${styles.features} ${className ?? ''}`.trim()} aria-label="자취선배 주요 기능">
    <div className={styles.column}>
      <RecordCard className={styles.fill} />
    </div>
    <div className={styles.column}>
      <ActionCard
        tone="informative"
        title={
          <>
            사용방법 <br className={styles.mobileBreak} />
            알아보기
          </>
        }
        aria-label="사용방법 알아보기"
        to="/guide"
        className={styles.guide}
        illustration={<ActionCardIllustration src={guideGoose} width={200} height={294} placement="peek" />}
      />
      <ActionCard
        title="인프라 지도"
        description="주변 교통과 편의시설을 살펴봐요"
        aria-label="인프라 보는 지도"
        to="/map"
        className={styles.fill}
        illustration={<ActionCardIllustration src={cardInfrastructure} width={320} height={320} />}
      />
      <ActionCard
        title="동네 찾기"
        description="통근 시간과 월세 평균을 비교해요"
        aria-label="동네 정보 찾기"
        to="/neighborhoods"
        className={styles.fill}
        illustration={<ActionCardIllustration src={cardNeighborhood} width={320} height={320} />}
      />
    </div>
  </section>
);

export default HomeFeatures;
