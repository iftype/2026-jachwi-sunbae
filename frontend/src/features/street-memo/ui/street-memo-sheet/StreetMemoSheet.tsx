import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';

import type { StreetMemoLayer } from '../../hooks/useStreetMemoLayer';
import type { StreetMemo } from '../../model/StreetMemo';
import StreetMemoContent, { streetMemoTitle } from '../street-memo-content/StreetMemoContent';

type Props = {
  layer: StreetMemoLayer;
  onCreated?: (memo: StreetMemo) => void;
};

/** 휴대폰에서 메모를 쓰거나 보는 바텀시트. 쓸 때는 입력칸까지 보이게 보기보다 높게 연다. */
const StreetMemoSheet = ({ layer, onCreated }: Props) => {
  if (layer.mode === null) return null;
  return (
    <BottomSheet
      title={streetMemoTitle(layer)}
      // 내용 높이에 맞춰 연다. 보기는 배지·내용·지우기 버튼, 쓰기는 선호·입력칸·버튼만큼이다.
      initialHeightPercent={layer.mode === 'compose' ? 48 : 30}
      resizable={false}
      closeLabel="메모 닫기"
      onClose={layer.close}
    >
      <StreetMemoContent layer={layer} onCreated={onCreated} />
    </BottomSheet>
  );
};

export default StreetMemoSheet;
