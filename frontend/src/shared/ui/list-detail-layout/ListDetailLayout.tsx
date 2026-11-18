import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import Icon from '@/shared/ui/icon/Icon';

type ListDetailLayoutProps = {
  /** 왼쪽 칸. 목록이나 입력 폼을 둔다. */
  list: ReactNode;
  floating?: boolean;
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
  floating = false,
  detail,
  onCloseDetail,
  closeLabel = '상세 닫기',
  children,
  className,
}: ListDetailLayoutProps) => {
  const hasDetail = detail !== undefined && detail !== null && detail !== false;
  return (
    <div
      className={`${styles.layout} ${className ?? ''}`.trim()}
      data-detail-open={hasDetail || undefined}
      data-floating={floating || undefined}
    >
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

    &[data-detail-open='true'] {
      grid-template-columns: var(--list-detail-list-width) var(--list-detail-detail-width) minmax(0, 1fr);
    }
    &[data-floating='true'] {
      position: relative;
      display: block;
      --map-panel-width: var(--list-detail-list-width);
      & > :first-child,
      & > :nth-child(2):not(:last-child) {
        position: absolute;
        top: var(--unified-panel-top, 1rem);
        bottom: 1rem;
        z-index: 40;
        width: var(--list-detail-list-width);
        border: 1px solid var(--color-border);
        border-radius: 1rem;
        box-shadow: 0 0.5rem 2rem rgb(0 0 0 / 16%);
        overscroll-behavior: contain;
      }
      & > :first-child {
        left: 1rem;
      }
      & > :nth-child(2):not(:last-child) {
        left: calc(var(--list-detail-list-width) + 1rem);
        width: var(--list-detail-detail-width);
      }
      &[data-detail-open='true'] {
        & > :first-child,
        & > :nth-child(2) {
          box-shadow: none;
        }
        & > :first-child {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
        & > :nth-child(2) {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
        --map-panel-width: calc(var(--list-detail-list-width) + var(--list-detail-detail-width));
      }
      & > :last-child {
        position: absolute;
        inset: 0;
      }
    }
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

  main: css`
    label: ListDetailLayout-main;
    position: relative;
    min-width: 0;
    min-height: 0;
  `,

  /* 본문 위에 다른 안내가 있으면 화면에서 --list-detail-close-top으로 닫기 버튼을 내린다. */
  close: css`
    label: ListDetailLayout-close;
    position: absolute;
    top: var(--list-detail-close-top, 1rem);
    left: calc(var(--map-panel-width, 0px) + 2.5rem);
    z-index: 50;
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    place-items: center;
    border: 1px solid #e3e5e9;
    border-radius: 0.6rem;
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
