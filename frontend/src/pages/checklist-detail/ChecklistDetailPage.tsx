import { css } from '@emotion/css';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { describeChecklistLoadError, getChecklistErrorMessage } from '@/features/checklist/api/checklistErrorMessages';
import { useRemoveChecklist, useUpdateChecklist } from '@/features/checklist/api/useChecklistMutations';
import { useChecklistDetail } from '@/features/checklist/api/useChecklists';
import type { ChecklistDetail } from '@/features/checklist/model/checklistTypes';
import { writeLastSelectedChecklist } from '@/features/checklist/model/lastChecklistStore';
import useChecklistDraft, { type ChecklistDraftInput } from '@/features/checklist/model/useChecklistDraft';
import useChecklistItemPickerRoute from '@/features/checklist/model/useChecklistItemPickerRoute';
import CheckItemPicker from '@/features/checklist/ui/checklist-editor/CheckItemPicker';
import ChecklistEditor from '@/features/checklist/ui/checklist-editor/ChecklistEditor';
import ChecklistEditorFrame from '@/features/checklist/ui/checklist-editor-frame/ChecklistEditorFrame';
import ChecklistEditorSkeleton from '@/features/checklist/ui/checklist-editor-frame/ChecklistEditorSkeleton';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { CHECKLISTS_PATH } from '@/shared/lib/navigation/appPaths';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import ContentState from '@/shared/ui/content-state/ContentState';
import QueryState from '@/shared/ui/query-state/QueryState';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

const describeError = describeChecklistLoadError('체크리스트를 불러오지 못했어요.', {
  CHECKLIST_NOT_FOUND: '체크리스트를 찾을 수 없어요.',
});

/** 관리 목록에서 선택한 사용자 체크리스트를 편집한다. */
const ChecklistDetailPage = () => {
  const checklistId = parsePositiveId(useParams().checklistId);
  if (checklistId === null)
    return (
      <ContentState title="올바른 체크리스트 주소가 아니에요.">
        <ButtonLink to={CHECKLISTS_PATH}>체크리스트 관리</ButtonLink>
      </ContentState>
    );
  return <ResolvedChecklistDetailPage checklistId={checklistId} />;
};

const ResolvedChecklistDetailPage = ({ checklistId }: { checklistId: number }) => {
  const detail = useChecklistDetail(checklistId);

  return (
    <QueryState
      query={detail}
      loadingTitle="체크리스트를 불러오는 중이에요."
      skeleton={<ChecklistEditorSkeleton />}
      describeError={describeError}
    >
      {(checklist) => <ChecklistDetailView key={checklist.checklistId} checklist={checklist} />}
    </QueryState>
  );
};

const ChecklistDetailView = ({ checklist }: { checklist: ChecklistDetail }) => {
  const update = useUpdateChecklist(checklist.checklistId);
  const remove = useRemoveChecklist(checklist.checklistId);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const goBack = () => navigate(CHECKLISTS_PATH, { replace: true });
  const { isPickerOpen, openPicker, closePicker } = useChecklistItemPickerRoute();
  const draft = useChecklistDraft({
    initialName: checklist.name,
    initialItems: checklist.items,
    isSubmitting: update.isPending,
  });

  const save = async ({ name, items }: ChecklistDraftInput) => {
    const saved = await update.mutateAsync({ name, items });
    // 새 매물에도 이 체크리스트가 바로 적용되도록 기억한다.
    writeLastSelectedChecklist(saved.checklistId);
    goBack();
    return saved;
  };

  if (isPickerOpen)
    return (
      <ChecklistEditorFrame isDesktop={isDesktop} className={styles.page}>
        <TopNavigation
          className={styles.topNavigation}
          title="체크 항목 추가"
          backLabel="체크리스트 편집으로 돌아가기"
          navigationIcon="arrow-left"
          onBack={closePicker}
        />
        <CheckItemPicker
          stage={checklist.stage}
          existingSourceIds={draft.providedSourceIds}
          disabled={update.isPending}
          onCancel={closePicker}
          onAdd={(items) => {
            if (draft.addItems(items)) closePicker();
          }}
        />
      </ChecklistEditorFrame>
    );

  return (
    <ChecklistEditorFrame isDesktop={isDesktop} className={styles.page}>
      <TopNavigation
        className={styles.topNavigation}
        endSlot={
          <Button
            ref={deleteRef}
            variant="neutral"
            aria-label="체크리스트 삭제"
            onClick={() => {
              remove.reset();
              setIsDeleteOpen(true);
            }}
          >
            삭제
          </Button>
        }
        title="체크리스트 편집"
        backLabel="체크리스트 관리로 돌아가기"
        navigationIcon={isDesktop ? 'close' : 'arrow-left'}
        onBack={goBack}
      />
      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="체크리스트를 삭제할까요?"
        description="저장된 사용자 체크리스트를 삭제해요. 이미 매물에 적용된 체크 기록은 유지돼요."
        confirmLabel="삭제"
        isConfirming={remove.isPending}
        returnFocusRef={deleteRef}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => remove.mutate(undefined, { onSuccess: goBack })}
      >
        {remove.isError && <p role="alert">{getChecklistErrorMessage(remove.error)}</p>}
      </ConfirmDialog>
      <ChecklistEditor
        stage={checklist.stage}
        draft={draft}
        submitLabel="변경 내용 저장"
        isSubmitting={update.isPending}
        serverError={update.isError ? getChecklistErrorMessage(update.error) : undefined}
        onOpenItemPicker={openPicker}
        onSubmit={save}
      />
    </ChecklistEditorFrame>
  );
};

const styles = {
  page: css`
    label: ChecklistDetailPage-page;
    padding-right: 1rem;
    padding-left: 1rem;
  `,

  topNavigation: css`
    label: ChecklistDetailPage-topNavigation;
    margin-bottom: 0;
  `,
};

export default ChecklistDetailPage;
