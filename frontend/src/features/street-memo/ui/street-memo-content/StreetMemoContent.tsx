import type { StreetMemoLayer } from '../../hooks/useStreetMemoLayer';
import type { StreetMemo } from '../../model/StreetMemo';
import StreetMemoDetails from '../street-memo-details/StreetMemoDetails';
import StreetMemoForm from '../street-memo-form/StreetMemoForm';

type Props = {
  layer: StreetMemoLayer;
  onCreated?: (memo: StreetMemo) => void;
};

export const streetMemoTitle = (layer: StreetMemoLayer) => (layer.mode === 'compose' ? '메모 남기기' : '거리 메모');

/** 메모 겹의 상태에 맞춰 작성 폼이나 고른 메모를 보여준다. 데스크탑 칸과 휴대폰 시트가 함께 쓴다. */
const StreetMemoContent = ({ layer, onCreated }: Props) => {
  if (layer.mode === 'compose')
    return (
      <StreetMemoForm
        isSubmitting={layer.isSubmitting}
        submitFailed={layer.submitFailed}
        onSubmit={(memo, preference) => layer.submit(memo, preference, onCreated)}
        onCancel={layer.close}
      />
    );
  if (layer.selectedMemo)
    return (
      <StreetMemoDetails
        // 다른 메모를 고르면 지우기 확인 상태를 처음으로 되돌린다.
        key={layer.selectedMemo.id}
        memo={layer.selectedMemo}
        isRemoving={layer.isRemoving}
        removeFailed={layer.removeFailed}
        onRemove={layer.remove}
      />
    );
  return null;
};

export default StreetMemoContent;
