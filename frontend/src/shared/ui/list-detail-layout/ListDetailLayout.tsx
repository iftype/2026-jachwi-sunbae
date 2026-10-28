import type { ReactNode } from 'react';

import Icon from '@/shared/ui/icon/Icon';

import styles from './ListDetailLayout.module.css';

type ListDetailLayoutProps = {
  /** 왼쪽 칸. 목록이나 입력 폼을 둔다. */
  list: ReactNode;
  /** 목록 옆에 붙여 여는 상세. 없으면 목록과 본문만 둔다. */
  detail?: ReactNode;
  /** 상세 닫기. 버튼은 본문(지도) 왼쪽 위, 상세 칸 바로 옆에 띄운다. */
  onCloseDetail?: () => void;
  closeLabel?: string;
  /** 오른쪽 본문. 보통 지도다. */
  children: ReactNode;
  className?: string;
};

/**
 * 데스크탑의 목록 · 상세 · 본문 세 칸 배치. 상세를 열어도 목록을 덮지 않고 옆에 붙여, 목록을 보면서 다른 항목의 상세로 바로 옮겨 갈 수 있다.
 * 동네 찾기의 동네 목록 · 대중교통 상세 · 지도에 쓰고, 매물 목록 · 체크리스트처럼 같은 구도의 화면에서도 쓸 수 있게 공용으로 둔다.
 */
const ListDetailLayout = ({
  list,
  detail,
  onCloseDetail,
  closeLabel = '상세 닫기',
  children,
  className,
}: ListDetailLayoutProps) => {
  const hasDetail = detail !== undefined && detail !== null && detail !== false;
  return (
    <div className={`${styles.layout} ${className ?? ''}`.trim()} data-detail-open={hasDetail || undefined}>
      <div className={styles.list}>{list}</div>
      {hasDetail && <div className={styles.detail}>{detail}</div>}
      <div className={styles.main}>
        {children}
        {hasDetail && onCloseDetail && (
          <button type="button" className={styles.close} aria-label={closeLabel} onClick={onCloseDetail}>
            <Icon name="close" size={24} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ListDetailLayout;
