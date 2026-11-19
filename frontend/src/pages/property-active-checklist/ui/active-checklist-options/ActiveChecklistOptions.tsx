import { css, cx } from '@emotion/css';

import type { ChecklistSummary } from '@/features/checklist/model/checklistTypes';
import { CHECKLIST_CREATE_PATH, propertyChecklistCreatePath } from '@/shared/lib/navigation/appPaths';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import SelectionControl from '@/shared/ui/selection-control/SelectionControl';

import { SYSTEM_DEFAULT_ID } from '../../hooks/useChecklistSelection';

type ActiveChecklistOptionsProps = {
  items: ChecklistSummary[];
  propertyId?: number;
  selectedId: number | null;
  currentId?: number | null;
  newlyCreatedId: number | null;
  isDisabled: boolean;
  onSelect: (checklistId: number) => void;
  /** 주면 만들기를 다른 주소로 가지 않고 이 함수로 제자리에서 연다(데스크탑 패널). */
  onCreate?: () => void;
};

const ActiveChecklistOptions = ({
  items,
  propertyId,
  selectedId,
  currentId = null,
  newlyCreatedId,
  isDisabled,
  onSelect,
  onCreate,
}: ActiveChecklistOptionsProps) => (
  <fieldset className={`${styles.options} active-checklist-options`}>
    <legend className="sr-only">적용할 체크리스트</legend>
    <SelectionControl
      className={selectedId === SYSTEM_DEFAULT_ID ? 'is-selected' : undefined}
      name="active-checklist"
      value="SYSTEM_DEFAULT"
      checked={selectedId === SYSTEM_DEFAULT_ID}
      disabled={isDisabled}
      markClassName={styles.selectionMark}
      onSelect={() => onSelect(SYSTEM_DEFAULT_ID)}
    >
      <span>
        <strong>자취선배 기본 체크리스트</strong>
        <small>이 단계의 필수 항목으로 바로 시작</small>
      </span>
      {currentId === SYSTEM_DEFAULT_ID && <em>현재</em>}
    </SelectionControl>
    <div className={styles.userChecklists} role="group" aria-label="내 체크리스트">
      <div className={styles.groupHeading}>
        <h2>내 체크리스트</h2>
        {onCreate === undefined ? (
          <ButtonLink
            to={propertyId === undefined ? CHECKLIST_CREATE_PATH : propertyChecklistCreatePath(propertyId)}
            variant="neutral"
            className={styles.manageAction}
            aria-label="새 체크리스트"
          >
            <Icon name="plus" size={14} />
            만들기
          </ButtonLink>
        ) : (
          <Button
            type="button"
            variant="neutral"
            className={styles.manageAction}
            aria-label="새 체크리스트"
            disabled={isDisabled}
            onClick={onCreate}
          >
            <Icon name="plus" size={14} />
            만들기
          </Button>
        )}
      </div>
      {items.length === 0 && <p className={styles.empty}>저장된 내 체크리스트가 없어요.</p>}
      {items.map((item) => (
        <SelectionControl
          key={item.checklistId}
          className={selectedId === item.checklistId ? 'is-selected' : undefined}
          name="active-checklist"
          value={String(item.checklistId)}
          checked={selectedId === item.checklistId}
          disabled={isDisabled}
          markClassName={styles.selectionMark}
          onSelect={() => onSelect(item.checklistId)}
        >
          <span>
            <strong>{item.name}</strong>
            <small>{item.itemCount}개 항목</small>
          </span>
          {currentId === item.checklistId ? (
            <em>현재</em>
          ) : newlyCreatedId === item.checklistId ? (
            <em>방금 생성</em>
          ) : null}
        </SelectionControl>
      ))}
    </div>
  </fieldset>
);

const styles = {
  userChecklists: css`
    label: ActiveChecklistOptions-userChecklists;
    display: grid;
    gap: var(--space-sm);
    margin-top: var(--space-md);
  `,
  groupHeading: css`
    label: ActiveChecklistOptions-groupHeading;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    & h2 {
      margin: 0;
      font-size: 0.9375rem;
    }
  `,
  manageAction: css`
    label: ActiveChecklistOptions-manageAction;
    min-height: 2.25rem;
    padding: 0.4rem 0.8rem;
    font-size: 0.75rem;
    & > span {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  `,
  empty: css`
    label: ActiveChecklistOptions-empty;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.8125rem;
  `,
  // 다른 요소의 선택자에서 `.ActiveChecklistOptions-options`로 가리킨다.
  options: cx(
    css`
      label: ActiveChecklistOptions-options;
      display: grid;
      gap: 0.55rem;
      margin: 0;
      padding: 0;
      border: 0;

      & label {
        display: grid;
        grid-template-columns: 1.35rem minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.75rem;
        min-height: 4.5rem;
        padding: 0.9rem 1rem;
        border: 0;
        border-radius: 1rem;
        background: var(--color-card-surface);
        cursor: pointer;
      }

      & label.is-selected {
        background: color-mix(in srgb, var(--color-brand-blue) 16%, white);
      }

      & label:has(input:focus-visible) {
        outline: 2px solid var(--color-focus);
        outline-offset: 2px;
      }

      & strong,
      & small {
        display: block;
        overflow-wrap: anywhere;
      }

      & strong {
        font-size: 0.875rem;
        line-height: 1.4;
      }

      & small {
        margin-top: 0.1rem;
        color: var(--color-muted);
        font-size: 0.75rem;
      }

      & em {
        padding: 0.25rem 0.55rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--color-brand-blue) 22%, white);
        color: var(--color-brand-blue-ink);
        font-size: 0.7rem;
        font-style: normal;
        font-weight: 700;
      }
    `,
    'ActiveChecklistOptions-options',
  ),

  selectionMark: css`
    label: ActiveChecklistOptions-selectionMark;
    display: grid;
    flex: none;
    box-sizing: border-box;
    width: 1.35rem;
    height: 1.35rem;
    border: 1.5px solid var(--color-border-strong);
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-on-card-accent);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
    place-items: center;

    .ActiveChecklistOptions-options label.is-selected & {
      border-color: var(--color-brand-blue);
      background: var(--color-brand-blue);
    }
  `,
};

export default ActiveChecklistOptions;
