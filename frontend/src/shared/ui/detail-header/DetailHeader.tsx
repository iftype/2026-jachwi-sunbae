import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import Icon from '../icon/Icon';

type DetailHeaderProps = {
  title: string;
  onBack: () => void;
  backLabel: string;
  /** false면 뒤로가기 버튼을 그리지 않는다. 다른 닫는 수단이 이미 있는 데스크탑 패널이 쓴다. */
  hasBackButton?: boolean;
  /** 제목 오른쪽 끝에 둘 것(메뉴, 이전과 다음 등). */
  endSlot?: ReactNode;
};

/**
 * 매물 상세와 같은 모양의 머리줄. 왼쪽에 둥근 "<" 버튼, 그 오른쪽에 왼쪽 정렬 제목, 오른쪽 끝에 추가 동작을 둔다.
 * 사진 관리처럼 상세에서 이어 열리는 화면이 상세와 높이와 모양이 달라 보이지 않게 이 컴포넌트를 쓴다.
 */
const DetailHeader = ({ title, onBack, backLabel, hasBackButton = true, endSlot }: DetailHeaderProps) => (
  <header className={styles.header}>
    {hasBackButton && (
      <button className={styles.backButton} type="button" aria-label={backLabel} onClick={onBack}>
        <Icon name="chevron-left" size={24} />
      </button>
    )}
    <h1 className={styles.title} title={title}>
      {title}
    </h1>
    {endSlot}
  </header>
);

const styles = {
  header: css`
    label: DetailHeader-header;
    position: relative;
    display: flex;
    min-height: 3.5rem;
    align-items: center;
    gap: 0.5rem;
  `,

  backButton: css`
    label: DetailHeader-backButton;
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-radius: 50%;
    padding: 0;
    background: transparent;
    color: var(--color-ink);
    cursor: pointer;
  `,

  title: css`
    label: DetailHeader-title;
    min-width: 0;
    flex: 1;
    margin: 0;
    overflow: hidden;
    color: var(--color-ink);
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
};

export default DetailHeader;
