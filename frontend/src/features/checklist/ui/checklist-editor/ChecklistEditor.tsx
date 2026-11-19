import { useMemo } from 'react';

import AddItemAction from '@/shared/ui/add-item-action/AddItemAction';
import BottomActionArea from '@/shared/ui/bottom-action-area/BottomActionArea';
import { Button } from '@/shared/ui/button/Button';
import TextField from '@/shared/ui/text-field/TextField';

import { useActiveCheckItems } from '../../api/useChecklists';
import type { ChecklistEditorItem } from '../../model/ChecklistEditor';
import type { ChecklistDetail, ChecklistStage } from '../../model/checklistTypes';
import type { ChecklistDraft, ChecklistDraftInput } from '../../model/useChecklistDraft';
import ChecklistItemOrderList from './ChecklistItemOrderList';

import * as styles from './ChecklistEditor.styles';

type ChecklistEditorProps = {
  stage: ChecklistStage;
  draft: ChecklistDraft;
  submitLabel: string;
  isSubmitting: boolean;
  serverError?: string;
  onOpenItemPicker: () => void;
  onSubmit: (input: ChecklistDraftInput) => Promise<ChecklistDetail>;
};

/** 체크리스트 항목과 순서를 고치는 폼. 이름과 항목을 함께 저장한다. 항목 추가 화면은 `CheckItemPicker`가 맡는다. */
const ChecklistEditor = ({
  stage,
  draft,
  submitLabel,
  isSubmitting,
  serverError,
  onOpenItemPicker,
  onSubmit,
}: ChecklistEditorProps) => {
  const activeCatalog = useActiveCheckItems(stage);
  const activeSourceIds = useMemo(
    () => new Set(activeCatalog.data?.content.map((item) => item.checkItemId) ?? []),
    [activeCatalog.data],
  );
  const isInactive = (item: ChecklistEditorItem) =>
    item.origin === 'PROVIDED' && activeCatalog.isSuccess && !activeSourceIds.has(item.sourceCheckItemId);

  const submitArea = (
    <BottomActionArea placement="screen" className={`${styles.fixedActions} ${styles.editorActions}`}>
      <div className={styles.addActionRow}>
        <AddItemAction compact disabled={isSubmitting} onClick={onOpenItemPicker}>
          항목 추가
        </AddItemAction>
      </div>
      <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} loadingLabel="저장 중…">
        {submitLabel}
      </Button>
    </BottomActionArea>
  );

  return (
    <form
      className={`${styles.checklistEditor} ${styles.fixedSubmitEditor}`}
      onSubmit={(event) => {
        event.preventDefault();
        void draft.submit(onSubmit);
      }}
    >
      <p className={styles.editorSaveStatus} role="status" aria-live="polite">
        {draft.announcement}
      </p>
      {serverError !== undefined && (
        <p className="form-error" role="alert">
          {serverError} 작성한 내용은 그대로 유지됩니다. 같은 버튼으로 다시 시도할 수 있어요.
        </p>
      )}

      <TextField
        label="체크리스트 이름"
        value={draft.name}
        maxLength={50}
        disabled={isSubmitting}
        onChange={(event) => draft.setName(event.target.value)}
        error={draft.nameError ?? undefined}
      />
      <section className={styles.editorSection} aria-labelledby="selected-items-heading">
        <div className={styles.sectionHeadingRow}>
          <div>
            <h2 id="selected-items-heading">추가된 체크리스트</h2>
          </div>
          <span className={styles.selectionCount}>{draft.items.length}개</span>
        </div>
        {draft.items.length === 0 ? (
          <p className={styles.emptyItems}>체크 항목을 한 개 이상 추가해 주세요.</p>
        ) : (
          <ChecklistItemOrderList
            items={draft.items}
            isDisabled={isSubmitting}
            isInactive={isInactive}
            registerFocusTarget={draft.registerFocusTarget}
            onMove={draft.move}
            onReorder={draft.reorder}
            onRemove={draft.remove}
          />
        )}
        {draft.itemError !== null && (
          <p className="form-error" role="alert">
            {draft.itemError}
          </p>
        )}
      </section>
      {submitArea}
    </form>
  );
};

export default ChecklistEditor;
