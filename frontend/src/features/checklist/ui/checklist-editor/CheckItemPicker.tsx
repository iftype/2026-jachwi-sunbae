import { Fragment, useMemo, useState } from 'react';

import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';
import BottomActionArea from '@/shared/ui/bottom-action-area/BottomActionArea';
import { Button } from '@/shared/ui/button/Button';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';
import SearchField from '@/shared/ui/search-field/SearchField';
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/segmented-control/SegmentedControl';

import { getChecklistErrorMessage } from '../../api/checklistErrorMessages';
import { useCheckItemSearch } from '../../api/useChecklists';
import { checklistCategories, groupChecklistItems } from '../../lib/checklistCategories';
import type { CheckItem, ChecklistStage } from '../../model/checklistTypes';
import ChecklistCategorySection from './ChecklistCategorySection';

import * as styles from './ChecklistEditor.styles';

type CheckItemPickerProps = {
  stage: ChecklistStage;
  existingSourceIds: number[];
  disabled: boolean;
  onCancel: () => void;
  onAdd: (items: CheckItem[]) => void;
};

const CheckItemPicker = ({ stage, existingSourceIds, disabled, onCancel, onAdd }: CheckItemPickerProps) => {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<number, CheckItem>>(() => new Map());
  const [category, setCategory] = useState('ALL');
  const result = useCheckItemSearch(stage, query);
  // 빠른 응답에는 로딩 표시 없이 바로 항목을 보여 주고, 오래 걸릴 때만 그 자리에 Progress Circle을 둔다.
  const isLoadingVisible = useDelayedLoading(result.isPending);
  const items = useMemo(() => result.data?.pages.flatMap((page) => page.content) ?? [], [result.data]);
  const existingIds = useMemo(() => new Set(existingSourceIds), [existingSourceIds]);
  const groups = groupChecklistItems(
    items.filter((item) => category === 'ALL' || (item.category ?? 'OTHER') === category),
  );
  const additionCount = [...selectedItems.keys()].filter((id) => !existingIds.has(id)).length;

  const search = (nextQuery: string) => setQuery(nextQuery.trim());

  const addSelected = () => {
    const selected = [...selectedItems.values()].filter((item) => !existingIds.has(item.checkItemId));
    if (selected.length === 0) return;
    onAdd(selected);
    setSelectedItems(new Map());
  };

  return (
    <div className={`${styles.checklistEditor} ${styles.checklistItemPickerView}`}>
      <section className={styles.itemPicker} aria-labelledby="item-picker-heading">
        <div className={styles.sectionHeadingRow}>
          <div>
            <h2 id="item-picker-heading">체크 항목 검색</h2>
          </div>
        </div>
        <div className={styles.checkItemSearch}>
          <SearchField
            label="제공 항목 검색"
            variant="filled"
            value={input}
            placeholder="예: 채광, 관리비, 소음"
            disabled={disabled}
            showSubmitButton={false}
            onValueChange={setInput}
            onSubmit={() => search(input)}
            onClear={() => {
              setInput('');
              setQuery('');
            }}
          />
        </div>

        <SegmentedControl
          value={category}
          onValueChange={setCategory}
          disabled={disabled}
          aria-label="체크 항목 카테고리"
          className={styles.categoryFilters}
        >
          <SegmentedControlItem value="ALL">전체</SegmentedControlItem>
          {checklistCategories.map((item) => (
            <SegmentedControlItem key={item.code} value={item.code}>
              {item.name}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>

        <BottomActionArea placement="screen" className={`${styles.fixedActions} ${styles.pickerActions}`}>
          <p aria-live="polite">{additionCount}개 선택</p>
          <Button variant="secondary" type="button" disabled={disabled} onClick={onCancel}>
            취소
          </Button>
          <Button type="button" disabled={disabled || additionCount === 0} onClick={addSelected}>
            선택한 {additionCount}개 항목 추가
          </Button>
        </BottomActionArea>

        {result.isPending || isLoadingVisible ? (
          isLoadingVisible && (
            <div className={styles.compactState}>
              <ProgressCircle size={24} label="항목을 불러오는 중이에요." />
            </div>
          )
        ) : result.isError ? (
          <div className={styles.pickerError} role="alert">
            <span>{getChecklistErrorMessage(result.error)}</span>
            <Button
              className={styles.pickerRetry}
              type="button"
              variant="text"
              disabled={disabled}
              onClick={() => void result.refetch()}
            >
              다시 시도
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className={styles.compactState}>검색 결과가 없어요.</p>
        ) : (
          <div className={styles.checkItemResults}>
            <h3>검색 결과</h3>
            {groups.map((group) => {
              const orderedItems = [
                ...group.items.filter((item) => !existingIds.has(item.checkItemId)),
                ...group.items.filter((item) => existingIds.has(item.checkItemId)),
              ];
              return (
                <ChecklistCategorySection key={group.code} category={group}>
                  <ul className={styles.checkItemSearchResults}>
                    {orderedItems.map((item, index) => {
                      const exists = existingIds.has(item.checkItemId);
                      const checked = exists || selectedItems.has(item.checkItemId);
                      const startsExistingGroup =
                        exists && (index === 0 || !existingIds.has(orderedItems[index - 1].checkItemId));
                      const toggleItem = () => {
                        setSelectedItems((current) => {
                          const next = new Map(current);
                          if (next.has(item.checkItemId)) next.delete(item.checkItemId);
                          else next.set(item.checkItemId, item);
                          return next;
                        });
                      };
                      return (
                        <Fragment key={item.checkItemId}>
                          {startsExistingGroup && <li className={styles.existingDivider}>이미 추가됨</li>}
                          <li className={exists ? styles.alreadyAddedItem : undefined}>
                            <button
                              className={styles.resultSelect}
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              disabled={disabled || exists}
                              onPointerDown={(event) => {
                                // 모바일 WebView에서 pointerup 이후 click이 누락되는 경우에도
                                // 누른 순간 선택 상태가 바뀌도록 한다.
                                event.preventDefault();
                                toggleItem();
                              }}
                              onClick={(event) => {
                                // 키보드(Enter/Space)는 pointer 이벤트 없이 click만 발생한다.
                                if (event.detail === 0) toggleItem();
                              }}
                            >
                              <span
                                className={styles.resultControl}
                                data-selected={checked || undefined}
                                aria-hidden="true"
                              >
                                {checked ? '✓' : null}
                              </span>
                              <span className={styles.resultCopy}>
                                <strong>{item.question}</strong>
                                {item.guide !== null && <small>{item.guide}</small>}
                              </span>
                            </button>
                          </li>
                        </Fragment>
                      );
                    })}
                  </ul>
                </ChecklistCategorySection>
              );
            })}
          </div>
        )}

        {result.hasNextPage && (
          <Button
            variant="secondary"
            fullWidth
            className={styles.compactButton}
            type="button"
            disabled={disabled || result.isFetchingNextPage}
            onClick={() => void result.fetchNextPage()}
          >
            {result.isFetchingNextPage ? '불러오는 중…' : '항목 더 보기'}
          </Button>
        )}
      </section>
    </div>
  );
};

export default CheckItemPicker;
