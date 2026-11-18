import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useUnsavedChangesGuard } from '@/shared/lib/hooks/useUnsavedChangesGuard';

import { validateChecklistName } from '../lib/checklist';
import { editorItemsFingerprint, moveEditorItem } from '../lib/checklistEditor';
import { checkItemToEditorItem, type ChecklistEditorItem, checklistItemToEditorItem } from './ChecklistEditor';
import type { CheckItem, ChecklistDetail, ChecklistItem } from './checklistTypes';

type UseChecklistDraftOptions = {
  initialName: string;
  /** 저장된 체크리스트 항목이나, 새로 담을 제공 항목(프리셋) 목록 */
  initialItems: ChecklistItem[] | CheckItem[];
  isSubmitting: boolean;
};

export type ChecklistDraftInput = { name: string; items: ChecklistEditorItem[] };

const toEditorItems = (items: ChecklistItem[] | CheckItem[]): ChecklistEditorItem[] =>
  items.map((item) => ('checklistItemId' in item ? checklistItemToEditorItem(item) : checkItemToEditorItem(item)));

const hasDuplicateQuestion = (items: ChecklistEditorItem[]) => {
  const questions = new Set<string>();
  return items.some((item) => {
    const question = item.question.trim();
    if (questions.has(question)) return true;
    questions.add(question);
    return false;
  });
};

/**
 * 저장 전 체크리스트 이름과 항목 순서를 관리한다.
 * 편집 화면과 항목 추가 화면이 같은 초안을 공유할 수 있도록 화면 밖에서 쓴다.
 */
const useChecklistDraft = ({ initialName, initialItems: sourceItems, isSubmitting }: UseChecklistDraftOptions) => {
  const initialItems = useMemo(() => toEditorItems(sourceItems), [sourceItems]);
  const incomingItemsFingerprint = useMemo(() => editorItemsFingerprint(initialItems), [initialItems]);
  const [baselineName, setBaselineName] = useState(initialName);
  const [baselineItemsFingerprint, setBaselineItemsFingerprint] = useState(incomingItemsFingerprint);
  const [name, setName] = useState(initialName);
  const [items, setItems] = useState(initialItems);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [pendingFocusKey, setPendingFocusKey] = useState<string | null>(null);
  const itemFocusTargets = useRef(new Map<string, HTMLElement>());
  const submissionInFlight = useRef(false);
  const isDirty = name !== baselineName || editorItemsFingerprint(items) !== baselineItemsFingerprint;
  useUnsavedChangesGuard(isDirty && !isSubmitting);

  // 서버 내용이 바뀌었고 사용자가 아직 고치지 않았다면 새 내용으로 맞춘다.
  useEffect(() => {
    if (isDirty || (initialName === baselineName && incomingItemsFingerprint === baselineItemsFingerprint)) return;
    setName(initialName);
    setItems(initialItems);
    setBaselineName(initialName);
    setBaselineItemsFingerprint(incomingItemsFingerprint);
  }, [baselineItemsFingerprint, baselineName, incomingItemsFingerprint, initialItems, initialName, isDirty]);

  useEffect(() => {
    if (pendingFocusKey === null) return;
    itemFocusTargets.current.get(pendingFocusKey)?.focus();
    setPendingFocusKey(null);
  }, [items, pendingFocusKey]);

  const nameError = validateChecklistName(name);
  const itemError =
    items.length === 0
      ? '체크 항목을 한 개 이상 추가해 주세요.'
      : hasDuplicateQuestion(items)
        ? '같은 질문을 중복해서 추가할 수 없어요.'
        : null;
  const providedSourceIds = useMemo(
    () => items.flatMap((item) => (item.origin === 'PROVIDED' ? [item.sourceCheckItemId] : [])),
    [items],
  );

  /** 항목을 옮기거나 지운 뒤 포커스를 돌려줄 요소를 등록한다. */
  const registerFocusTarget = useCallback(
    (clientKey: string) => (element: HTMLElement | null) => {
      if (element === null) itemFocusTargets.current.delete(clientKey);
      else itemFocusTargets.current.set(clientKey, element);
    },
    [],
  );

  const move = (index: number, direction: -1 | 1, focusContent = true) => {
    const item = items[index];
    setItems(moveEditorItem(items, index, direction));
    if (focusContent) setPendingFocusKey(item.clientKey);
    setAnnouncement(`${item.question} 항목을 ${direction === -1 ? '위로' : '아래로'} 이동했어요.`);
  };

  const reorder = (sourceKey: string, targetKey: string) => {
    const sourceIndex = items.findIndex((item) => item.clientKey === sourceKey);
    const targetIndex = items.findIndex((item) => item.clientKey === targetKey);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(sourceIndex, 1);
    if (movedItem === undefined) return;
    nextItems.splice(targetIndex, 0, movedItem);
    setItems(nextItems);
    setAnnouncement(`${movedItem.question} 항목을 ${targetIndex + 1}번째로 이동했어요.`);
  };

  /** `moveFocus`가 false면 포커스를 옮기지 않는다. 다른 칸의 체크 상자로 지울 때 쓴다. */
  const remove = (index: number, moveFocus = true) => {
    const removed = items[index];
    const nextItems = items.filter((_, candidateIndex) => candidateIndex !== index);
    const nextFocusItem = nextItems[Math.min(index, nextItems.length - 1)];
    setItems(nextItems);
    if (moveFocus) setPendingFocusKey(nextFocusItem?.clientKey ?? null);
    setAnnouncement(`${removed.question} 항목을 제거했어요. 저장하기 전까지 서버에는 반영되지 않습니다.`);
  };

  /** 이미 담긴 제공 항목은 건너뛰고 목록 끝에 붙인다. 새로 담은 항목이 있는지 돌려준다. */
  const addItems = (newItems: CheckItem[], moveFocus = true): boolean => {
    const existingIds = new Set(providedSourceIds);
    const additions = newItems.filter((item) => !existingIds.has(item.checkItemId)).map(checkItemToEditorItem);
    if (additions.length === 0) return false;
    setItems((current) => [...current, ...additions]);
    if (moveFocus) setPendingFocusKey(additions[0].clientKey);
    setAnnouncement(`${additions.length}개 체크 항목을 목록 끝에 추가했어요.`);
    return true;
  };

  /** 검증을 통과하면 저장하고, 서버가 돌려준 내용을 새 기준으로 삼는다. */
  const submit = async (save: (input: ChecklistDraftInput) => Promise<ChecklistDetail>) => {
    setHasSubmitted(true);
    if (nameError !== null || itemError !== null || submissionInFlight.current) return;
    submissionInFlight.current = true;
    setAnnouncement('체크리스트를 저장하고 있어요.');
    try {
      const saved = await save({ name: name.trim(), items });
      const savedItems = saved.items.map(checklistItemToEditorItem);
      setName(saved.name);
      setItems(savedItems);
      setBaselineName(saved.name);
      setBaselineItemsFingerprint(editorItemsFingerprint(savedItems));
      setHasSubmitted(false);
      setAnnouncement('체크리스트를 저장했어요. 서버에서 확인한 최신 내용입니다.');
    } catch {
      setAnnouncement('저장하지 못했어요. 작성한 내용은 그대로 있어요. 다시 저장해 주세요.');
    } finally {
      submissionInFlight.current = false;
    }
  };

  return {
    name,
    setName,
    items,
    providedSourceIds,
    announcement,
    nameError: hasSubmitted ? nameError : null,
    itemError: hasSubmitted ? itemError : null,
    registerFocusTarget,
    move,
    reorder,
    remove,
    addItems,
    submit,
  };
};

export type ChecklistDraft = ReturnType<typeof useChecklistDraft>;

export default useChecklistDraft;
