import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import type { SheetMode } from '@/shared/ui/bottom-sheet/BottomSheet';
import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';

import type { RecordsState } from '../hooks/useRecords';
import RecordGroupList from '../ui/record-group/RecordGroupList';

type Props = {
  /** 지도에서 고른 매물. 겹쳐 묶인 마커를 누르면 여러 개다. */
  records: RecordsState['records'];
  onClose: () => void;
  /** 매물 하나를 볼 때 머리 오른쪽에 둘 이전, 다음 화살표. */
  stepper?: ReactNode;
  onNotice: (message: string) => void;
  /** 시트 바로 위 오른쪽에 띄울 것(현재 위치 버튼). */
  floating?: ReactNode;
  /** 시트를 접어 둔 선호. 선택을 풀었다 다시 골라도 접힌 채 열린다. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

/**
 * 휴대폰 지도에서 고른 매물을 보는 바텀시트. 겹친 매물은 함께 늘어놓고, 카드를 누르면 상세 화면으로 간다.
 * 매물 하나를 볼 때는 머리의 이전, 다음 화살표로 앞뒤 매물로 넘긴다. 시트는 그대로 두고 내용만 바꾼다.
 */
const RecordsSelectedSheet = ({
  records,
  onClose,
  stepper,
  onNotice,
  floating,
  collapsed,
  onCollapsedChange,
}: Props) => {
  if (records.length === 0) return null;
  return (
    <BottomSheet
      title={records.length > 1 ? `이 자리 매물 ${records.length}개` : '선택한 매물'}
      // 카드 한 장이면 그만큼만, 여러 장이면 두세 장이 보이게 연다. 더 많으면 끌어 올려 본다.
      initialHeightPercent={records.length > 1 ? 45 : 28}
      closeLabel="매물 닫기"
      // 접어도 선택은 그대로다. 닫기(X)와 지도 빈 곳 누르기만 선택을 푼다.
      collapsible
      initialMode={collapsed ? 'peek' : 'default'}
      onModeChange={(mode: SheetMode) => onCollapsedChange(mode === 'peek')}
      onClose={onClose}
      // 이전, 다음 이동은 시트가 작게 올라와 있을 때 쓴다. 크게 열면 숨긴다.
      headerEnd={stepper}
      hidesHeaderEndWhenExpanded
      floating={floating}
    >
      <RecordGroupList records={records} onNotice={onNotice} className={styles.list} />
    </BottomSheet>
  );
};

const styles = {
  list: css`
    label: RecordsSelectedSheet-list;
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  `,
};

export default RecordsSelectedSheet;
