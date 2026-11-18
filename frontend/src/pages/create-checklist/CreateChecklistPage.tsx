import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { getChecklistErrorMessage } from '@/features/checklist/api/checklistErrorMessages';
import { useCreateChecklist } from '@/features/checklist/api/useChecklistMutations';
import { USER_CHECKLIST_STAGE } from '@/features/checklist/model/checklist';
import type { CheckItem } from '@/features/checklist/model/checklistTypes';
import { writeLastSelectedChecklist } from '@/features/checklist/model/lastChecklistStore';
import useChecklistDraft, { type ChecklistDraftInput } from '@/features/checklist/model/useChecklistDraft';
import useChecklistItemPickerRoute from '@/features/checklist/model/useChecklistItemPickerRoute';
import CheckItemPicker from '@/features/checklist/ui/checklist-editor/CheckItemPicker';
import ChecklistEditor from '@/features/checklist/ui/checklist-editor/ChecklistEditor';
import ChecklistEditorFrame from '@/features/checklist/ui/checklist-editor-frame/ChecklistEditorFrame';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import {
  CHECKLIST_PROPERTY_ID_PARAM,
  CHECKLISTS_PATH,
  propertyActiveChecklistPath,
} from '@/shared/lib/navigation/appPaths';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import CreateChecklistDesktop from './ui/create-checklist-desktop/CreateChecklistDesktop';

const stage = USER_CHECKLIST_STAGE;
const initialItems: CheckItem[] = [];

const CreateChecklistPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = parsePositiveId(searchParams.get(CHECKLIST_PROPERTY_ID_PARAM) ?? undefined);
  const [isChoosingInitialItems, setIsChoosingInitialItems] = useState(true);
  const create = useCreateChecklist();
  const isDesktop = useIsDesktop();
  const { isPickerOpen, openPicker, closePicker } = useChecklistItemPickerRoute();
  const draft = useChecklistDraft({ initialName: '내 체크리스트', initialItems, isSubmitting: create.isPending });

  useEffect(() => {
    trackPostHogEvent('checklist_creation_started', { stage });
  }, []);

  const returnToSource = (newChecklistId?: number) => {
    if (propertyId === null) {
      navigate(CHECKLISTS_PATH, { replace: true });
      return;
    }
    navigate(`${propertyActiveChecklistPath(propertyId, stage)}?mode=replace`, {
      replace: true,
      state: { from: 'property-detail', newChecklistId },
    });
  };

  const save = async ({ name, items }: ChecklistDraftInput) => {
    try {
      trackPostHogEvent('checklist_creation_submitted', { stage });
      const created = await create.mutateAsync({ name, stage, items });
      trackPostHogEvent('checklist_created', { stage });
      writeLastSelectedChecklist(created.checklistId);
      returnToSource(created.checklistId);
      return created;
    } catch (error) {
      trackPostHogEvent('checklist_save_failed', { stage, error_kind: error instanceof Error ? 'request' : 'unknown' });
      throw error;
    }
  };

  const showPicker = isChoosingInitialItems || isPickerOpen;
  const leavePicker = () => {
    if (isChoosingInitialItems) returnToSource();
    else closePicker();
  };

  // 데스크탑은 한 화면 두 칸이라 항목 고르기 단계와 주소(`?mode=add-items`)를 쓰지 않는다. 저장 요청과 분석 이벤트는 같다.
  if (isDesktop) {
    return (
      <CreateChecklistDesktop
        stage={stage}
        draft={draft}
        isSubmitting={create.isPending}
        serverError={create.isError ? getChecklistErrorMessage(create.error) : undefined}
        closeLabel={propertyId === null ? '체크리스트 관리로 돌아가기' : '체크리스트 교체로 돌아가기'}
        onClose={() => returnToSource()}
        onSubmit={save}
      />
    );
  }

  return (
    <ChecklistEditorFrame isDesktop={isDesktop}>
      <TopNavigation
        className={styles.topNavigation}
        title={isPickerOpen && !isChoosingInitialItems ? '체크 항목 추가' : '체크리스트 만들기'}
        backLabel={
          showPicker && !isChoosingInitialItems
            ? '체크리스트 만들기로 돌아가기'
            : propertyId === null
              ? '체크리스트 관리로 돌아가기'
              : '체크리스트 교체로 돌아가기'
        }
        navigationIcon="arrow-left"
        onBack={showPicker ? leavePicker : () => returnToSource()}
      />
      {showPicker ? (
        <CheckItemPicker
          stage={stage}
          existingSourceIds={draft.providedSourceIds}
          disabled={create.isPending}
          onCancel={leavePicker}
          onAdd={(items) => {
            if (!draft.addItems(items)) return;
            setIsChoosingInitialItems(false);
            closePicker();
          }}
        />
      ) : (
        <ChecklistEditor
          stage={stage}
          draft={draft}
          submitLabel="체크리스트 저장"
          isSubmitting={create.isPending}
          serverError={create.isError ? getChecklistErrorMessage(create.error) : undefined}
          onOpenItemPicker={openPicker}
          onSubmit={save}
          isDesktop={isDesktop}
        />
      )}
    </ChecklistEditorFrame>
  );
};

const styles = {
  topNavigation: css`
    label: CreateChecklistPage-topNavigation;
    margin-bottom: 0;
  `,
};

export default CreateChecklistPage;
