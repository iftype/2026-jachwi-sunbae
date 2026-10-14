import { Link } from 'react-router-dom';

import styles from './NeighborhoodEntryPage.module.css';

const NeighborhoodEntryPage = () => (
  <main className={styles.page}>
    <h1>자취할 동네를 찾아보세요</h1>
    <div className={styles.options}>
      <Link to="/neighborhoods/map?mode=commute">
        <strong>거리로 찾기</strong>
        <span>통근 시간과 환승 조건으로 동네 살펴보기</span>
      </Link>
      <Link to="/neighborhoods/map?mode=price">
        <strong>월세 평균가 보기</strong>
        <span>주변 동네의 최근 월세 거래 평균 살펴보기</span>
      </Link>
    </div>
  </main>
);
export default NeighborhoodEntryPage;
