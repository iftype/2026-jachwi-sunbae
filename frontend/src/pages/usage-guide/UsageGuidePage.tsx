import { ButtonLink } from '@/shared/ui/button/Button';
import PageHeading from '@/shared/ui/page-heading/PageHeading';

import { useUsageGuideViewTracking } from './lib/usageGuideAnalytics';
import UsageDemo from './ui/usage-demo/UsageDemo';

import styles from './UsageGuidePage.module.css';

const RECORD_NOTES = [
  '처음 들어오면 가입이나 로그인 없이 기록 공간이 바로 만들어져요.',
  '같은 브라우저나 앱으로 다시 오면 기록이 그대로 이어져요.',
  '다른 브라우저·기기에서는 새 기록으로 시작하고, 사이트 데이터를 지우면 이전 기록을 불러올 수 없어요.',
];

/** 예전 랜딩을 대신하는 사용 방법. 회원 여부와 상관없이 볼 수 있고, 단계마다 실제 기능으로 이어 준다. */
const UsageGuidePage = () => {
  useUsageGuideViewTracking();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.introduction}>
          <PageHeading title="사용 방법" />
          <p>자취할 동네를 찾고, 직접 본 방을 기록해요.</p>
        </header>
        <section className={styles.recordNotice} aria-labelledby="record-notice-heading">
          <h2 id="record-notice-heading">로그인 없이 바로 시작해요</h2>
          <ul>
            {RECORD_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
        <UsageDemo />
        <div className={styles.actions}>
          <ButtonLink to="/" fullWidth>
            홈에서 시작하기
          </ButtonLink>
        </div>
      </div>
    </main>
  );
};

export default UsageGuidePage;
