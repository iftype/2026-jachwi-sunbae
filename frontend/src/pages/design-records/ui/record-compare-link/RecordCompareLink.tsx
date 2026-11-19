import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import { COMPARE_PATH } from '@/shared/lib/navigation/appPaths';

type Props = {
  /** 직접 기록한 방 수. 불러오는 중이거나 예시 매물뿐이면 넘기지 않아 숫자 없이 보인다. */
  count?: number;
};

/** 내 기록 목록 위 줄. 왼쪽에 `최근 기록한 방`, 오른쪽에 `비교하고 PDF로 받기` 링크를 두어 기록을 골라 비교하고 PDF로 받는 화면으로 보낸다. */
const RecordCompareLink = ({ count }: Props) => (
  <div className={styles.row}>
    <h3 className={styles.title}>
      최근 기록한 방{count !== undefined && <span className={styles.count}>{count}</span>}
    </h3>
    <Link to={COMPARE_PATH} aria-label="기록 비교하고 PDF로 받기">
      비교하고 PDF로 받기
    </Link>
  </div>
);

const styles = {
  row: css`
    label: RecordCompareLink-row;
    display: flex;
    flex: none;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    /* 고른 매물 카드 뒤 바탕(0.5rem)이 바로 아래 줄을 덮지 않도록 아래 여백을 두고 한 겹 위에 둔다. 가로 여백은 목록 칸이 이미 준다. */
    position: relative;
    z-index: 1;
    padding: 0 0 0.75rem;

    & a {
      color: var(--color-brand-blue-ink);
      font-size: 0.8rem;
      font-weight: 700;
      text-decoration: none;
    }
    & a:hover {
      text-decoration: underline;
    }
  `,
  title: css`
    label: RecordCompareLink-title;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.8rem;
    font-weight: 600;
  `,
  count: css`
    label: RecordCompareLink-count;
    margin-left: 0.35rem;
    font-size: 0.72rem;
    font-weight: 600;
  `,
};

export default RecordCompareLink;
