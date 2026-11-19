import type { ReactNode } from 'react';

import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';

import type { StreetMemoLayer } from '../../hooks/useStreetMemoLayer';
import type { StreetMemo } from '../../model/StreetMemo';
import StreetMemoContent, { streetMemoTitle } from '../street-memo-content/StreetMemoContent';

type Props = {
  layer: StreetMemoLayer;
  onCreated?: (memo: StreetMemo) => void;
  /** 시트 바로 위 오른쪽에 띄울 것(현재 위치 버튼 등). 시트와 함께 오르내린다. */
  floating?: ReactNode;
};

/** 휴대폰에서 메모를 쓰거나 보는 바텀시트. 쓸 때는 입력칸까지 보이게 보기보다 높게 연다. */
const StreetMemoSheet = ({ layer, onCreated, floating }: Props) => {
  if (layer.mode === null) return null;
  return (
    <BottomSheet
      title={streetMemoTitle(layer)}
      // 메모를 볼 때는 제목줄 없이 바로 좋아요, 싫어요 표시부터 보여 주고, 닫기(X)는 그 오른쪽에 작게 둔다.
      hideHeader={layer.mode === 'view'}
      // 쓸 때도 닫기(X)는 테두리 없는 작은 아이콘으로 맞춘다.
      compactClose
      // 내용 높이에 맞춰 연다. 보기는 배지·내용·지우기 버튼, 쓰기는 선호·입력칸·버튼만큼이다.
      initialHeightPercent={layer.mode === 'compose' ? 48 : 30}
      resizable={false}
      closeLabel="메모 닫기"
      onClose={layer.close}
      floating={floating}
    >
      <StreetMemoContent
        layer={layer}
        onCreated={onCreated}
        onClose={layer.mode === 'view' ? layer.close : undefined}
      />
    </BottomSheet>
  );
};

export default StreetMemoSheet;
