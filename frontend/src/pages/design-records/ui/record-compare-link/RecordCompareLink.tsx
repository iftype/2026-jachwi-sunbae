import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import { COMPARE_PATH } from '@/shared/lib/navigation/appPaths';

/** 내 기록 목록 오른쪽 위의 `비교하고 PDF로 받기` 링크. 누르면 기록을 골라 비교하고 PDF로 받는 화면으로 간다. */
const RecordCompareLink = () => (
  <div className={styles.row}>
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
    justify-content: flex-end;
    padding: 0.6rem 1.25rem 0;

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
};

export default RecordCompareLink;
