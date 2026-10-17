// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  customChecklistItemFixture,
  onlineItemFixture,
  providedChecklistItemFixture,
  secondOnlineItemFixture,
} from '@/app/mocks/fixtures/checklistFixtures';
import {
  editorItemsFingerprint,
  moveEditorItem,
  toProvidedChecklistItemInputs,
} from '@/features/checklist/lib/checklistEditor';
import { checkItemToEditorItem, checklistItemToEditorItem } from '@/features/checklist/model/ChecklistEditor';
import type { CheckItem, ChecklistItem } from '@/features/checklist/model/checklistTypes';

describe('체크리스트 편집 상태와 DTO 변환', () => {
  const optionalItem = checkItemToEditorItem(onlineItemFixture as CheckItem);
  const anotherOptionalItem = checkItemToEditorItem(secondOnlineItemFixture as CheckItem);
  const existingItem = checklistItemToEditorItem(providedChecklistItemFixture as ChecklistItem);

  it('새 API에는 시스템 제공 항목 ID만 순서대로 보낸다', () => {
    const customItem = checklistItemToEditorItem(customChecklistItemFixture as ChecklistItem);
    expect(toProvidedChecklistItemInputs([anotherOptionalItem, existingItem])).toEqual([
      { systemCheckItemId: anotherOptionalItem.sourceCheckItemId },
      { systemCheckItemId: existingItem.sourceCheckItemId },
    ]);
    expect(() => toProvidedChecklistItemInputs([customItem])).toThrow('제공 항목만');
  });

  it('편집 지문은 제공 항목은 원본 항목 ID로, 직접 추가 항목은 질문으로 구분한다', () => {
    const customItem = checklistItemToEditorItem(customChecklistItemFixture as ChecklistItem);
    expect(JSON.parse(editorItemsFingerprint([existingItem, customItem]))).toEqual([
      ['PROVIDED', existingItem.checklistItemId, existingItem.sourceCheckItemId],
      ['CUSTOM', customItem.checklistItemId, customItem.question],
    ]);
  });

  it('항목 식별자와 순서가 달라지면 편집 지문도 달라진다', () => {
    expect(editorItemsFingerprint([optionalItem, anotherOptionalItem])).not.toBe(
      editorItemsFingerprint([anotherOptionalItem, optionalItem]),
    );
  });

  it('시스템 항목 순서를 불변 배열로 이동하고 기존 ID를 유지한다', () => {
    const moved = moveEditorItem([optionalItem, existingItem], 1, -1);
    expect(moved.map((item) => item.sourceCheckItemId)).toEqual([
      existingItem.sourceCheckItemId,
      optionalItem.sourceCheckItemId,
    ]);
    expect(moved[0]?.checklistItemId).toBe(existingItem.checklistItemId);
    expect(moveEditorItem(moved, 0, -1)).toBe(moved);
  });
});
