import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';

import styles from './RouteLoading.module.css';

const RouteLoading = () => (
  <div className={styles.loading}>
    <ProgressCircle />
  </div>
);
export default RouteLoading;
