import styles from './RecordList.module.css';

/** 기록을 불러오는 동안 공용 매물 카드와 같은 모양의 스켈레톤을 보여 준다. */
const RecordListSkeleton = ({ className }: { className?: string }) => (
  <div className={className} role="status">
    <span className="sr-only">기록을 불러오는 중이에요.</span>
    <ul className={styles.items} aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <li key={index} className={styles.skeletonRoom}>
          <span className={`${styles.skeletonPhoto} ${styles.skeleton}`} />
          <span className={styles.skeletonLines}>
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
          </span>
        </li>
      ))}
    </ul>
  </div>
);

export default RecordListSkeleton;
