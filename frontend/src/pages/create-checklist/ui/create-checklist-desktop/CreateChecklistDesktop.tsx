import { css } from '@emotion/css';
import { useId, useMemo, useState } from 'react';

import { getChecklistErrorMessage } from '@/features/checklist/api/checklistErrorMessages';
import { useCheckItemSearch } from '@/features/checklist/api/useChecklists';
import { groupChecklistItems } from '@/features/checklist/lib/checklistCategories';
import type { CheckItem, ChecklistDetail, ChecklistStage } from '@/features/checklist/model/checklistTypes';
import type { ChecklistDraft, ChecklistDraftInput } from '@/features/checklist/model/useChecklistDraft';
import ChecklistItemOrderList from '@/features/checklist/ui/checklist-editor/ChecklistItemOrderList';
import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';
import SearchField from '@/shared/ui/search-field/SearchField';
import TextField from '@/shared/ui/text-field/TextField';

type CreateChecklistDesktopProps = {
  stage: ChecklistStage;
  draft: ChecklistDraft;
  isSubmitting: boolean;
  serverError?: string;
  closeLabel: string;
  onClose: () => void;
  onSubmit: (input: ChecklistDraftInput) => Promise<ChecklistDetail>;
};

const isNotInactive = () => false;

/**
 * 데스크탑 체크리스트 만들기. 한 화면 두 칸으로, 왼쪽에서 기본 제공 항목을 카테고리별로 접고 펼쳐 체크하면
 * 바로 오른쪽 선택 목록에 담기고, 오른쪽에서 이름을 적고 순서를 바꿔 저장한다.
 * 모바일의 두 단계 흐름(항목 고르기, 편집)과 같은 초안과 저장 요청을 쓴다.
 */
const CreateChecklistDesktop = ({
  stage,
  draft,
  isSubmitting,
  serverError,
  closeLabel,
  onClose,
  onSubmit,
}: CreateChecklistDesktopProps) => {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [openCodes, setOpenCodes] = useState<ReadonlySet<string>>(() => new Set(['SECURITY']));
  const result = useCheckItemSearch(stage, query);
  const isLoadingVisible = useDelayedLoading(result.isPending);
  const items = useMemo(() => result.data?.pages.flatMap((page) => page.content) ?? [], [result.data]);
  const groups = useMemo(() => groupChecklistItems(items), [items]);
  const selectedIds = useMemo(() => new Set(draft.providedSourceIds), [draft.providedSourceIds]);
  const isSearching = query !== '';

  const toggleGroup = (code: string) =>
    setOpenCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const toggleItem = (item: CheckItem) => {
    if (selectedIds.has(item.checkItemId)) {
      const index = draft.items.findIndex((candidate) => candidate.sourceCheckItemId === item.checkItemId);
      if (index >= 0) draft.remove(index, false);
      return;
    }
    draft.addItems([item], false);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>새 체크리스트</h1>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          <Icon name="close" size={22} />
        </button>
      </header>
      <div className={styles.columns}>
        <section className={styles.pickColumn} aria-labelledby="create-pick-heading">
          <h2 id="create-pick-heading" className={styles.sectionTitle}>
            기본 제공 항목
          </h2>
          <SearchField
            label="제공 항목 검색"
            value={input}
            placeholder="예: 채광, 관리비, 소음"
            disabled={isSubmitting}
            showSubmitButton={false}
            onValueChange={setInput}
            onSubmit={() => setQuery(input.trim())}
            onClear={() => {
              setInput('');
              setQuery('');
            }}
          />
          {result.isPending ? (
            isLoadingVisible && (
              <div className={styles.state}>
                <ProgressCircle size={24} label="항목을 불러오는 중이에요." />
              </div>
            )
          ) : result.isError ? (
            <div className={styles.state} role="alert">
              <span>{getChecklistErrorMessage(result.error)}</span>
              <Button variant="text" onClick={() => void result.refetch()}>
                다시 시도
              </Button>
            </div>
          ) : groups.length === 0 ? (
            <p className={styles.state}>검색 결과가 없어요.</p>
          ) : (
            <div className={styles.groups}>
              {groups.map((group) => (
                <CategoryGroup
                  key={group.code}
                  name={group.name}
                  icon={group.icon}
                  total={group.items.length}
                  selected={group.items.filter((item) => selectedIds.has(item.checkItemId)).length}
                  isOpen={isSearching || openCodes.has(group.code)}
                  onToggle={() => toggleGroup(group.code)}
                >
                  {group.items.map((item) => (
                    <li key={item.checkItemId}>
                      <label className={styles.row}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.checkItemId)}
                          disabled={isSubmitting}
                          onChange={() => toggleItem(item)}
                        />
                        <span>
                          <strong>{item.question}</strong>
                          {item.guide !== null && <small>{item.guide}</small>}
                        </span>
                      </label>
                    </li>
                  ))}
                </CategoryGroup>
              ))}
            </div>
          )}
          {result.hasNextPage && (
            <Button
              variant="secondary"
              fullWidth
              disabled={isSubmitting || result.isFetchingNextPage}
              onClick={() => void result.fetchNextPage()}
            >
              {result.isFetchingNextPage ? '불러오는 중…' : '항목 더 보기'}
            </Button>
          )}
        </section>

        <form
          className={styles.draftColumn}
          onSubmit={(event) => {
            event.preventDefault();
            void draft.submit(onSubmit);
          }}
        >
          <p className={styles.status} role="status" aria-live="polite">
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
          <section className={styles.selected} aria-labelledby="create-selected-heading">
            <h2 id="create-selected-heading" className={styles.sectionTitle}>
              선택한 항목 <span>{draft.items.length}개</span>
            </h2>
            {draft.items.length === 0 ? (
              <p className={styles.empty}>왼쪽에서 체크 항목을 골라 담아 주세요.</p>
            ) : (
              <div className={styles.selectedList}>
                <ChecklistItemOrderList
                  items={draft.items}
                  isDisabled={isSubmitting}
                  isInactive={isNotInactive}
                  registerFocusTarget={draft.registerFocusTarget}
                  onMove={draft.move}
                  onReorder={draft.reorder}
                  onRemove={draft.remove}
                />
              </div>
            )}
            {draft.itemError !== null && (
              <p className="form-error" role="alert">
                {draft.itemError}
              </p>
            )}
          </section>
          <div className={styles.actions}>
            <Button type="submit" size="large" fullWidth isLoading={isSubmitting} loadingLabel="저장 중…">
              체크리스트 저장
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
};

type CategoryGroupProps = {
  name: string;
  icon: Parameters<typeof Icon>[0]['name'];
  total: number;
  selected: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

/** 접고 펼치는 카테고리 한 묶음. 머리줄에 담은 개수를 보여 준다. */
const CategoryGroup = ({ name, icon, total, selected, isOpen, onToggle, children }: CategoryGroupProps) => {
  const panelId = useId();
  return (
    <section className={styles.group}>
      <h3>
        <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={onToggle}>
          <Icon name={icon} size={18} />
          <span>{name}</span>
          <small>
            {selected}/{total}
          </small>
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} />
        </button>
      </h3>
      <ul id={panelId} hidden={!isOpen} className={styles.rows}>
        {children}
      </ul>
    </section>
  );
};

const styles = {
  page: css`
    label: CreateChecklistDesktop-page;
    /* 데스크탑 셸이 이 화면에서는 선 색을 투명으로 두므로, 구분선이 보이게 토큰의 진한 선 색을 쓴다. */
    --color-border: var(--color-border-strong);
    width: 100%;
    max-width: 960px;
    min-height: 100%;
    margin: 0 auto;
    padding: 0 1.5rem 2rem;
    background: var(--color-canvas);
  `,
  header: css`
    label: CreateChecklistDesktop-header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 3.5rem;
    & h1 {
      margin: 0;
      font-size: 1.0625rem;
      font-weight: 600;
    }
  `,
  close: css`
    label: CreateChecklistDesktop-close;
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    margin-right: -0.6rem;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-ink);
    cursor: pointer;
    &:hover {
      background: var(--color-surface-muted);
    }
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
  columns: css`
    label: CreateChecklistDesktop-columns;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
  `,
  sectionTitle: css`
    label: CreateChecklistDesktop-sectionTitle;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    & span {
      margin-left: 0.25rem;
      color: var(--color-muted);
      font-size: 0.75rem;
      font-weight: 400;
    }
  `,
  pickColumn: css`
    label: CreateChecklistDesktop-pickColumn;
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  `,
  groups: css`
    label: CreateChecklistDesktop-groups;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    overflow: hidden;
  `,
  group: css`
    label: CreateChecklistDesktop-group;
    & + & {
      border-top: 1px solid var(--color-border);
    }
    & h3 {
      margin: 0;
    }
    & h3 button {
      display: flex;
      width: 100%;
      min-height: 2.75rem;
      align-items: center;
      gap: 0.5rem;
      padding: 0 0.85rem;
      border: 0;
      background: transparent;
      color: var(--color-ink);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }
    & h3 button:hover {
      background: var(--color-surface-muted);
    }
    & h3 button:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: -2px;
    }
    & h3 button > span {
      flex: 1;
    }
    & h3 button > small {
      color: var(--color-muted);
      font-size: 0.75rem;
      font-weight: 400;
    }
  `,
  rows: css`
    label: CreateChecklistDesktop-rows;
    margin: 0;
    padding: 0 0.85rem 0.35rem;
    list-style: none;
    &[hidden] {
      display: none;
    }
    & li + li {
      border-top: 1px solid var(--color-border);
    }
  `,
  row: css`
    label: CreateChecklistDesktop-row;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
    min-height: 2.75rem;
    padding: 0.4rem 0;
    cursor: pointer;
    & input {
      width: 1.125rem;
      height: 1.125rem;
      margin: 0;
      accent-color: var(--color-primary);
    }
    & strong {
      display: block;
      font-size: 0.8125rem;
      font-weight: 400;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    & small {
      display: block;
      margin-top: 0.1rem;
      color: var(--color-muted);
      font-size: 0.72rem;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
  `,
  state: css`
    label: CreateChecklistDesktop-state;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin: 0;
    padding: 1.5rem 0;
    color: var(--color-muted);
    font-size: 0.8125rem;
  `,
  draftColumn: css`
    label: CreateChecklistDesktop-draftColumn;
    position: sticky;
    top: 0;
    display: grid;
    gap: 0.9rem;
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  `,
  status: css`
    label: CreateChecklistDesktop-status;
    margin: 0;
    &:empty {
      display: none;
    }
    color: var(--color-muted);
    font-size: 0.78rem;
  `,
  selected: css`
    label: CreateChecklistDesktop-selected;
    display: grid;
    gap: 0.5rem;
  `,
  selectedList: css`
    label: CreateChecklistDesktop-selectedList;
    max-height: max(8rem, calc(100dvh - 28rem));
    min-height: 8rem;
    overflow-y: auto;
    padding: 0 0.85rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
  `,
  empty: css`
    label: CreateChecklistDesktop-empty;
    margin: 0;
    padding: 1.5rem 0.85rem;
    background: var(--color-card-surface);
    border-radius: 12px;
    color: var(--color-muted);
    font-size: 0.8125rem;
    text-align: center;
  `,
  actions: css`
    label: CreateChecklistDesktop-actions;
    position: sticky;
    bottom: 0;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
  `,
};

export default CreateChecklistDesktop;
