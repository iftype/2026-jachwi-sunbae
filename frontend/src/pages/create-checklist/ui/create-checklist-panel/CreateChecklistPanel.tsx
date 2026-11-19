import { useEffect, useState } from 'react';

import { getChecklistErrorMessage } from '@/features/checklist/api/checklistErrorMessages';
import { useCreateChecklist } from '@/features/checklist/api/useChecklistMutations';
import { USER_CHECKLIST_STAGE } from '@/features/checklist/model/checklist';
import type { CheckItem } from '@/features/checklist/model/checklistTypes';
import { writeLastSelectedChecklist } from '@/features/checklist/model/lastChecklistStore';
import useChecklistDraft, { type ChecklistDraftInput } from '@/features/checklist/model/useChecklistDraft';
import CheckItemPicker from '@/features/checklist/ui/checklist-editor/CheckItemPicker';
import ChecklistEditor from '@/features/checklist/ui/checklist-editor/ChecklistEditor';
import ChecklistPageLayout from '@/features/checklist/ui/checklist-page-layout/ChecklistPageLayout';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

const stage = USER_CHECKLIST_STAGE;
const initialItems: CheckItem[] = [];

type CreateChecklistPanelProps = {
  /** 저장하지 않고 나갈 때. 부른 화면이 이전 화면으로 되돌린다. */
  onClose: () => void;
  /** 저장이 끝났을 때. 새로 만든 체크리스트 id를 넘긴다. */
  onCreated: (checklistId: number) => void;
};

/**
 * 다른 화면 안에서 주소를 바꾸지 않고 열리는 체크리스트 만들기.
 * 상세 패널 폭에 맞춰 모바일과 같은 두 단계(항목 고르기, 편집)로 보여 주고, 단계는 화면 안 상태로만 가진다.
 * 초안, 저장 요청, 분석 이벤트는 `CreateChecklistPage`와 같다.
 */
const CreateChecklistPanel = ({ onClose, onCreated }: CreateChecklistPanelProps) => {
  const [isChoosingInitialItems, setIsChoosingInitialItems] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const create = useCreateChecklist();
  const draft = useChecklistDraft({ initialName: '내 체크리스트', initialItems, isSubmitting: create.isPending });

  useEffect(() => {
    trackPostHogEvent('checklist_creation_started', { stage });
  }, []);

  const save = async ({ name, items }: ChecklistDraftInput) => {
    try {
      trackPostHogEvent('checklist_creation_submitted', { stage });
      const created = await create.mutateAsync({ name, stage, items });
      trackPostHogEvent('checklist_created', { stage });
      writeLastSelectedChecklist(created.checklistId);
      onCreated(created.checklistId);
      return created;
    } catch (error) {
      trackPostHogEvent('checklist_save_failed', { stage, error_kind: error instanceof Error ? 'request' : 'unknown' });
      throw error;
    }
  };

  const showPicker = isChoosingInitialItems || isPickerOpen;
  const isAddingItems = showPicker && !isChoosingInitialItems;
  const leavePicker = () => {
    if (isChoosingInitialItems) onClose();
    else setIsPickerOpen(false);
  };

  return (
    <ChecklistPageLayout
      embedded
      title={isAddingItems ? '체크 항목 추가' : '체크리스트 만들기'}
      onBack={showPicker ? leavePicker : onClose}
      backLabel={isAddingItems ? '체크리스트 만들기로 돌아가기' : '체크리스트 교체로 돌아가기'}
      className="property-page checklist-page checklist-editor-page"
    >
      {showPicker ? (
        <CheckItemPicker
          stage={stage}
          existingSourceIds={draft.providedSourceIds}
          disabled={create.isPending}
          onCancel={leavePicker}
          onAdd={(items) => {
            if (!draft.addItems(items)) return;
            setIsChoosingInitialItems(false);
            setIsPickerOpen(false);
          }}
        />
      ) : (
        <ChecklistEditor
          stage={stage}
          draft={draft}
          submitLabel="체크리스트 저장"
          isSubmitting={create.isPending}
          serverError={create.isError ? getChecklistErrorMessage(create.error) : undefined}
          onOpenItemPicker={() => setIsPickerOpen(true)}
          onSubmit={save}
          isDesktop
        />
      )}
    </ChecklistPageLayout>
  );
};

export default CreateChecklistPanel;
