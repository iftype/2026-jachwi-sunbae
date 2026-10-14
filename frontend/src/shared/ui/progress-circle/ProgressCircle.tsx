import styles from './ProgressCircle.module.css';

type ProgressCircleProps = { size?: 24 | 40; label?: string };
const ProgressCircle = ({ size = 40, label = '화면을 불러오는 중이에요.' }: ProgressCircleProps) => (
  <span className={styles.progress} role="progressbar" aria-label={label} style={{ width: size, height: size }}>
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle className={styles.track} cx="20" cy="20" r="17.5" />
      <circle className={styles.indicator} cx="20" cy="20" r="17.5" />
    </svg>
  </span>
);
export default ProgressCircle;
