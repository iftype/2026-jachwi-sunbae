import ActionCard from '@/shared/ui/action-card/ActionCard';

import recordHouse from '../assets/record-house.webp';
import recordNotebook from '../assets/record-notebook.webp';
import recordPencil from '../assets/record-pencil.webp';

import styles from './RecordCard.module.css';

/** 홈의 대표 카드. 노트·연필·집을 카드 가장자리에 걸쳐 두고, 처음 그려질 때와 마우스를 올릴 때 조금씩 움직인다. */
const RecordCard = ({ className }: { className?: string }) => (
  <ActionCard
    tone="brand"
    size="large"
    title="매물 기록하기"
    description="직접 본 매물을 기록해요"
    to="/properties"
    className={`${styles.record} ${className ?? ''}`.trim()}
    illustration={
      <span className={styles.scene} aria-hidden="true">
        <img className={styles.notebook} src={recordNotebook} alt="" width={480} height={480} />
        <img className={styles.pencil} src={recordPencil} alt="" width={480} height={480} />
        <img className={styles.house} src={recordHouse} alt="" width={480} height={480} />
      </span>
    }
  />
);

export default RecordCard;
