import { css } from '@emotion/css';
import { useState } from 'react';

import Tooltip from '@/shared/ui/tooltip/Tooltip';

const SEEN_KEY = 'jachwi:neighborhood-commute-tip-seen';

const hasSeen = (): boolean => {
  try {
    return localStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    // 저장소를 못 쓰면 매번 띄우지 않는다.
    return true;
  }
};

type Props = {
  /** 검색창에 입력을 시작했는지. 입력을 시작하면 안내를 닫고 봤음으로 저장한다. */
  hasInput: boolean;
  /** 안내를 보일 때(위치를 고르기 전)만 true. */
  enabled: boolean;
};

/**
 * 동네 찾기 첫 단계에서 처음 쓰는 사람에게만 출퇴근 장소 칸 아래에 한 번 띄우는 안내 툴팁.
 * `확인`을 누르거나 출퇴근 장소 입력을 시작하면 닫고 다시 띄우지 않는다. 부모는 `position: relative`인 검색창 줄이어야 한다.
 */
const FinderSearchTip = ({ hasInput, enabled }: Props) => {
  const [isOpen, setIsOpen] = useState(() => !hasSeen());
  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, 'true');
    } catch {
      // 저장소를 쓸 수 없으면 이번 화면에서만 닫는다.
    }
    setIsOpen(false);
  };
  if (isOpen && hasInput) close();
  if (!isOpen || !enabled) return null;
  return (
    <div className={styles.anchor}>
      <Tooltip
        placement="bottom"
        align="start"
        content="출퇴근 장소를 정하면 통근 시간이 짧은 동네를 찾아 드려요"
        action={{ label: '확인', onClick: close }}
      >
        <span className={styles.point} />
      </Tooltip>
    </div>
  );
};

const styles = {
  /* 검색창 줄 아래 가운데에서 말풍선이 아래로 펼쳐진다. */
  anchor: css`
    label: FinderSearchTip-anchor;
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 45;
  `,
  point: css`
    label: FinderSearchTip-point;
    display: block;
    width: 1px;
    height: 1px;
  `,
};

export default FinderSearchTip;
