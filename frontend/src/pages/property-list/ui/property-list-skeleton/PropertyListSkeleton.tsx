import styles from './PropertyListSkeleton.module.css';

const PropertyListSkeleton = ({ showHeader = false }: { showHeader?: boolean }) => (
  <div
    className={`${styles.skeleton} ${showHeader ? styles.page : ''}`}
    role="status"
    aria-label="매물 목록을 불러오는 중이에요."
  >
    <div aria-hidden="true">
      {showHeader && (
        <div className={styles.heading}>
          <span />
          <span />
        </div>
      )}
      {[0, 1, 2, 3].map((item) => (
        <div className={styles.card} key={item}>
          <span className={styles.image} />
          <div className={styles.body}>
            <span className={styles.title} />
            <span />
            <span />
            <span className={styles.progress} />
          </div>
        </div>
      ))}
    </div>
  </div>
);
export default PropertyListSkeleton;
