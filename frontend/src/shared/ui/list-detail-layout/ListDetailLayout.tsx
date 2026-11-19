import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import Icon from '@/shared/ui/icon/Icon';

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
 * 데스크탑의 목록과 본문(지도) 두 칸 배치. 상세는 칸을 늘리지 않고 본문 왼쪽 위에 얹어, 목록을 보면서 다른 항목의 상세로 바로 옮겨 갈 수 있고 지도는 크기와 위치가 그대로다.
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
      <div className={styles.main}>
        {children}
        {/* 상세는 지도 옆 칸을 만들지 않고 지도 왼쪽 위에 얹는다. 지도 크기와 위치가 바뀌지 않고, 뱃지는 덮여도 된다. */}
        {hasDetail && <div className={styles.detail}>{detail}</div>}
        {hasDetail && onCloseDetail && (
          <button type="button" className={styles.close} aria-label={closeLabel} onClick={onCloseDetail}>
            <Icon name="close" size={22} />
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  layout: css`
    label: ListDetailLayout-layout;
    /* 목록과 상세 칸은 고정 폭 대신 화면 폭에 따라 최소와 최대 사이에서 줄어든다. 뼈대도 이 배치를 그대로 써서 폭이 같다. */
    --list-detail-list-width: clamp(20rem, 28%, 24rem);
    --list-detail-detail-width: clamp(22rem, 28%, 26rem);
    display: grid;
    grid-template-columns: var(--list-detail-list-width) minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  `,

  list: css`
    label: ListDetailLayout-list;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border-right: 1px solid #eceef1;
    background: white;

    & > * {
      flex: 1;
      min-height: 0;
    }
  `,

  detail: css`
    label: ListDetailLayout-detail;
    position: absolute;
    z-index: 40;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--list-detail-detail-width);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border-right: 1px solid #eceef1;
    background: white;
    box-shadow: 0 0 1.5rem rgb(0 0 0 / 14%);

    & > * {
      flex: 1;
      min-height: 0;
    }
  `,

  main: css`
    label: ListDetailLayout-main;
    position: relative;
    min-width: 0;
    min-height: 0;
  `,

  /* 패널 오른쪽 가장자리에 붙이고, 떠 있는 패널(z-index 40) 위에 올려 잘리지 않게 한다. 뱃지 줄과는 위치(위에서 6rem)로 겹치지 않게 한다. */
  close: css`
    label: ListDetailLayout-close;
    position: absolute;
    top: var(--list-detail-close-top, 1rem);
    /* 패널 오른쪽 가장자리에 붙여, 지도 위 다른 버튼과 떨어져 목록 패널의 일부처럼 보이게 한다. */
    /* 상세 칸 오른쪽 가장자리에 붙인다. */
    left: var(--list-detail-detail-width);
    z-index: 41;
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    place-items: center;
    border: 1px solid #e3e5e9;
    border-left: 0;
    border-radius: 0 0.6rem 0.6rem 0;
    background: white;
    box-shadow: 0 2px 10px rgb(0 0 0 / 12%);
    color: #383c43;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid #25282d;
      outline-offset: 2px;
    }
  `,
};

export default ListDetailLayout;
