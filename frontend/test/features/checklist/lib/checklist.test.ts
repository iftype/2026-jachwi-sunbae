// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { onlineItemFixture, secondOnlineItemFixture } from '@/app/mocks/fixtures/checklistFixtures';
import {
  hasUniqueSameStageItems,
  moveChecklistItem,
  parseChecklistReturnTo,
  validateChecklistName,
} from '@/features/checklist/lib/checklist';
import type { CheckItem } from '@/features/checklist/model/checklistTypes';

describe('체크리스트 편집 규칙', () => {
  it('이름을 trim 기준 1~50자로 검증한다', () => {
    expect(validateChecklistName('   ')).toBe('체크리스트 이름을 입력해 주세요.');
    expect(validateChecklistName('가'.repeat(51))).toBe('체크리스트 이름은 50자 이하로 입력해 주세요.');
    expect(validateChecklistName(` ${'가'.repeat(50)} `)).toBeNull();
    expect(validateChecklistName(' 같은 이름 허용 ')).toBeNull();
  });

  it('같은 단계의 중복되지 않은 항목이 한 개 이상이어야 한다', () => {
    const items = [onlineItemFixture, secondOnlineItemFixture] as CheckItem[];
    expect(hasUniqueSameStageItems(items, 'ON_SITE')).toBe(true);
    expect(hasUniqueSameStageItems([], 'ON_SITE')).toBe(false);
    expect(hasUniqueSameStageItems([items[0], items[0]], 'ON_SITE')).toBe(false);
    expect(hasUniqueSameStageItems(items, 'PRE_CONTRACT')).toBe(false);
    // 일부만 같은 단계여도 통과하지 않는다.
    expect(hasUniqueSameStageItems([items[0], { ...items[1], stage: 'PRE_CONTRACT' }], 'ON_SITE')).toBe(false);
  });

  it('순서를 불변 배열로 이동하고 경계 밖 이동은 원본을 유지한다', () => {
    const items = [onlineItemFixture, secondOnlineItemFixture] as CheckItem[];
    expect(moveChecklistItem(items, 1, -1).map((item) => item.checkItemId)).toEqual([102, 101]);
    expect(moveChecklistItem(items, 0, -1)).toBe(items);
  });

  it('정확한 매물 활성 체크리스트 내부 경로만 returnTo로 허용한다', () => {
    expect(parseChecklistReturnTo('/properties/10/active-checklists/ON_SITE')).toEqual({
      propertyId: 10,
      stage: 'ON_SITE',
      path: '/properties/10/active-checklists/ON_SITE',
    });
    expect(parseChecklistReturnTo('/properties/10/active-checklists/ON_SITE?from=property-detail')).toEqual({
      propertyId: 10,
      stage: 'ON_SITE',
      path: '/properties/10/active-checklists/ON_SITE?from=property-detail',
    });
    expect(parseChecklistReturnTo('https://evil.example/properties/10/active-checklists/ON_SITE')).toBeNull();
    expect(parseChecklistReturnTo('//evil.example')).toBeNull();
    expect(parseChecklistReturnTo('/properties/0/active-checklists/ON_SITE')).toBeNull();
    expect(parseChecklistReturnTo('/properties/1/active-checklists/PRE_CONTRACT')).toEqual({
      propertyId: 1,
      stage: 'PRE_CONTRACT',
      path: '/properties/1/active-checklists/PRE_CONTRACT',
    });
    expect(parseChecklistReturnTo('/properties/10/active-checklists/ON_SITE?from=map')).toBeNull();
    expect(parseChecklistReturnTo('/properties/10/active-checklists/DONE')).toBeNull();
    expect(parseChecklistReturnTo(null)).toBeNull();
  });
});
