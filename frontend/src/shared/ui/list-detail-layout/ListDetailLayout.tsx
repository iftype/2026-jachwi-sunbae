import { css } from '@emotion/css';
import { type ReactNode, useEffect, useId, useRef } from 'react';

import Icon from '@/shared/ui/icon/Icon';

import { setDetailCollapsed, useDetailCollapsed } from './detailCollapse';

type ListDetailLayoutProps = {
  /** 왼쪽 칸. 목록이나 입력 폼을 둔다. */
  list: ReactNode;
  /** 목록 옆에 붙여 여는 상세. 없으면 목록과 본문만 둔다. */
  detail?: ReactNode;
  /** 상세 닫기. 버튼은 본문(지도) 왼쪽 위, 상세 칸 바로 옆에 띄운다. `collapsible`이면 쓰지 않는다. */
  onCloseDetail?: () => void;
  closeLabel?: string;
  /**
   * 상세를 닫지 않고 접는다. 상세 옆 `<` 버튼으로 접고, 목록 패널 옆 `>` 버튼으로 다시 편다.
   * 접어도 상세는 그대로 두어 선택(URL과 강조)과 상세 안 상태가 남고, 접힌 상태는 다른 항목을 골라도, 새로고침해도 유지한다.
   */
  collapsible?: boolean;
  /** 오른쪽 본문. 보통 지도다. */
  children: ReactNode;
  className?: string;
};

/**
 * 데스크탑의 목록과 본문(지도) 배치. 지도는 레일 오른쪽 전체에 깔고, 목록과 상세는 그 위에 한 덩어리로 띄운다. 패널 둘레의 틈으로 실제 지도가 보이고, 상세를 열고 닫아도 지도 크기와 위치가 그대로다.
 * 패널이 가리는 폭은 `--map-panel-width`로 내려, 지도 위 왼쪽 기준 요소와 시점 계산이 그만큼 비켜 놓는다.
 * 동네 찾기의 동네 목록 · 대중교통 상세 · 지도에 쓰고, 매물 목록 · 체크리스트처럼 같은 구도의 화면에서도 쓸 수 있게 공용으로 둔다.
 */
const ListDetailLayout = ({
  list,
  detail,
  onCloseDetail,
  closeLabel = '상세 닫기',
  collapsible = false,
  children,
  className,
}: ListDetailLayoutProps) => {
  const hasDetail = detail !== undefined && detail !== null && detail !== false;
  const collapsed = useDetailCollapsed();
  const isCollapsed = collapsible && hasDetail && collapsed;
  const showsDetail = hasDetail && !isCollapsed;
  const detailId = useId();
  const collapseRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  // 접거나 편 버튼은 사라지므로, 키보드 초점을 반대쪽 버튼으로 옮긴다.
  const hasToggledRef = useRef(false);
  useEffect(() => {
    if (!hasToggledRef.current) return;
    hasToggledRef.current = false;
    (isCollapsed ? expandRef : collapseRef).current?.focus();
  }, [isCollapsed]);
  const toggle = (next: boolean) => {
    hasToggledRef.current = true;
    setDetailCollapsed(next);
  };
  return (
    // 지도 시점을 맞추는 쪽(`RecordsMapProvider`, 동네 찾기)이 `data-floating`으로 이 틀을 찾아 패널이 가리는 폭을 잰다.
    <div
      className={`${styles.layout} ${className ?? ''}`.trim()}
      data-detail-open={showsDetail || undefined}
      data-floating="true"
    >
      <div className={styles.list}>{list}</div>
      <div className={styles.main}>
        {children}
        {/* 상세는 목록 패널 오른쪽에 붙여 지도 위에 얹는다. 지도 크기와 위치는 바뀌지 않는다. 접어도 내용은 숨기기만 한다. */}
        {hasDetail && (
          <div id={detailId} className={styles.detail} data-list-detail-detail hidden={isCollapsed}>
            {detail}
          </div>
        )}
        {showsDetail && collapsible && (
          <button
            ref={collapseRef}
            type="button"
            className={styles.close}
            aria-label="상세 접기"
            aria-expanded
            aria-controls={detailId}
            onClick={() => toggle(true)}
          >
            <Icon name="chevron-left" size={24} />
          </button>
        )}
        {isCollapsed && (
          <button
            ref={expandRef}
            type="button"
            className={styles.close}
            aria-label="상세 펼치기"
            aria-expanded={false}
            aria-controls={detailId}
            onClick={() => toggle(false)}
          >
            <Icon name="chevron-right" size={24} />
          </button>
        )}
        {showsDetail && !collapsible && onCloseDetail && (
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
    /* 목록과 상세 패널을 지도 위에 띄워 보이는 간격과 위쪽 모서리. 내 기록, 동네 찾기, 저렴한 한 끼, 체크리스트, 마이 패널이 모두 이 틀을 써서 같은 값을 따른다. 아래는 화면 맨 아래에 붙인다. */
    --list-detail-gap: 0.625rem;
    --list-detail-radius: 1rem;
    /* 지도 위에서 패널이 가리는 왼쪽 폭. 지도 위 왼쪽 기준 요소와 시점 계산이 이 값만큼 비켜 놓는다. */
    --map-panel-width: calc(var(--list-detail-gap) + var(--list-detail-list-width));
    display: grid;
    /* 목록 칸 왼쪽에 레일과 띄우는 간격만큼 더한다. 지도 칸은 목록 칸까지 덮어 전체 폭으로 깐다. */
    grid-template-columns: calc(var(--list-detail-list-width) + var(--list-detail-gap)) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    /* 지도를 그리기 전에 비치는 바탕. 지도 바탕색과 맞춘다. */
    background: #e9e5d8;

    &[data-detail-open] {
      --map-panel-width: calc(
        var(--list-detail-gap) + var(--list-detail-list-width) + var(--list-detail-detail-width)
      );
    }
  `,

  /* 지도 칸 위에 띄운다. 둘레의 틈(margin)은 상자 밖이라 누르면 아래 지도가 받는다. */
  list: css`
    label: ListDetailLayout-list;
    position: relative;
    z-index: 1;
    grid-area: 1 / 1;
    /* 패널 안의 작은 지도(매물 상세의 주변 지도 등)는 패널에 가리지 않으므로 비켜 놓을 폭이 없다. */
    --map-panel-width: 0px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    margin: var(--list-detail-gap) 0 0 var(--list-detail-gap);
    border: 1px solid #eceef1;
    border-bottom: 0;
    border-radius: var(--list-detail-radius) var(--list-detail-radius) 0 0;
    background: white;

    /* 상세가 붙어 열리면 둘이 한 덩어리로 보이게 안쪽 모서리를 각지게 하고, 경계는 목록 오른쪽의 1px 선 하나로 둔다. */
    [data-detail-open] > & {
      border-top-right-radius: 0;
    }

    & > * {
      flex: 1;
      min-height: 0;
    }
  `,

  detail: css`
    label: ListDetailLayout-detail;
    position: absolute;
    z-index: 40;
    --map-panel-width: 0px;
    top: var(--list-detail-gap);
    bottom: 0;
    /* 목록 패널에 틈 없이 붙여 한 덩어리로 띄운다. 경계선은 목록 패널의 오른쪽 선이 맡는다. */
    left: calc(var(--list-detail-gap) + var(--list-detail-list-width));
    width: var(--list-detail-detail-width);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border: 1px solid #eceef1;
    border-left: 0;
    border-bottom: 0;
    border-radius: 0 var(--list-detail-radius) 0 0;
    background: white;

    &[hidden] {
      display: none;
    }

    & > * {
      flex: 1;
      min-height: 0;
    }
  `,

  /* 목록 칸까지 덮는 전체 폭. 지도 위 요소의 z-index가 떠 있는 목록 패널을 넘지 않게 따로 쌓는다. */
  main: css`
    label: ListDetailLayout-main;
    position: relative;
    z-index: 0;
    grid-area: 1 / 1 / 2 / -1;
    min-width: 0;
    min-height: 0;
  `,

  /* 패널 오른쪽 가장자리에 붙이고, 떠 있는 패널(z-index 40) 위에 올려 잘리지 않게 한다. 뱃지 줄과는 위치(위에서 6rem)로 겹치지 않게 한다. */
  close: css`
    label: ListDetailLayout-close;
    position: absolute;
    top: var(--list-detail-close-top, 1rem);
    /* 상세 칸(접었으면 목록 패널) 오른쪽 가장자리에 붙여, 지도 위 다른 버튼과 떨어져 패널의 일부처럼 보이게 한다. 닫기, 접기, 펼치기가 같은 자리를 쓴다. */
    left: var(--map-panel-width);
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
