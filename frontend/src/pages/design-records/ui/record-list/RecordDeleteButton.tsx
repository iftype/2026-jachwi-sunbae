import { useRemoveProperty } from '@/features/property/api/usePropertyMutations';
import Icon from '@/shared/ui/icon/Icon';

type RecordDeleteButtonProps = { propertyId: number; onDone: (message: string) => void };

const RecordDeleteButton = ({ propertyId, onDone }: RecordDeleteButtonProps) => {
  const removeProperty = useRemoveProperty(propertyId);
  return (
    <button
      type="button"
      disabled={removeProperty.isPending}
      onClick={() =>
        removeProperty.mutate(undefined, {
          onSuccess: () => onDone('기록을 삭제했어요.'),
          onError: () => onDone('기록을 삭제하지 못했어요. 다시 시도해주세요.'),
        })
      }
    >
      <Icon name="trash" size={16} /> 삭제
    </button>
  );
};

export default RecordDeleteButton;
