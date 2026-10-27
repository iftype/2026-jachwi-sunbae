import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { useAssignActiveChecklist } from '@/features/checklist/api/useChecklistMutations';
import { writeLastSelectedChecklist } from '@/features/checklist/model/lastChecklistStore';

type AssignMutation = ReturnType<typeof useAssignActiveChecklist>;

/** 기본 체크리스트를 가리키는 선택지 id */
export const SYSTEM_DEFAULT_ID = -1;

type UseChecklistSelectionOptions = {
  propertyId: number;
  assign: AssignMutation;
  fromPropertyDetail: boolean;
  initialSelectedId: number | null;
  current: { checklistId: number; name: string } | null;
  appliedPropertyChecklistId: number | null;
};

/** 교체할 체크리스트를 고르고 적용한다. 이미 적용된 체크리스트를 다시 고르면 그 화면으로 이동한다. */
const useChecklistSelection = ({
  propertyId,
  assign,
  fromPropertyDetail,
  initialSelectedId,
  current,
  appliedPropertyChecklistId,
}: UseChecklistSelectionOptions) => {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId);
  const detailState = fromPropertyDetail ? { state: { from: 'property-detail' } } : {};

  useEffect(() => {
    if (selectedId === null && current !== null) setSelectedId(current.checklistId);
  }, [current, selectedId]);

  const openChecklist = (propertyChecklistId: number, replace: boolean) =>
    navigate(`/properties/${propertyId}/checklists/${propertyChecklistId}`, { replace, ...detailState });

  const toggleSelection = (checklistId: number) => {
    if (current?.checklistId === checklistId && appliedPropertyChecklistId !== null) {
      // 교체 화면은 체크리스트 화면 기록을 대신한 것이므로, 다시 고른 체크리스트로도 기록을 쌓지 않고 바꿔 연다.
      openChecklist(appliedPropertyChecklistId, true);
      return;
    }
    setSelectedId(checklistId);
  };

  const saveSelection = async () => {
    if (selectedId === null) return;
    const selection = selectedId === SYSTEM_DEFAULT_ID ? ('SYSTEM_DEFAULT' as const) : selectedId;
    try {
      const applied = await assign.mutateAsync(selection);
      writeLastSelectedChecklist(selection);
      openChecklist(applied.propertyChecklistId, true);
    } catch {
      /* Keep the selected checklist visible for retry. */
    }
  };

  return {
    selectedId,
    isSelectionChanged: selectedId !== null && selectedId !== current?.checklistId,
    toggleSelection,
    saveSelection,
  };
};

export default useChecklistSelection;
