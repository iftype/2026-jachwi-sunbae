import { css } from '@emotion/css';

import type { ChecklistSummary } from '@/features/checklist/model/checklistTypes';
import ChecklistBundleCard from '@/features/checklist/ui/checklist-bundle-card/ChecklistBundleCard';
import { CHECKLIST_CREATE_PATH, propertyChecklistCreatePath } from '@/shared/lib/navigation/appPaths';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';

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
  <fieldset className={styles.options}>
    <legend className="sr-only">적용할 체크리스트</legend>
    <ChecklistBundleCard
      kind="option"
      title="자취선배 기본 체크리스트"
      description="이 단계의 필수 항목으로 바로 시작"
      badge={currentId === SYSTEM_DEFAULT_ID ? '현재' : undefined}
      name="active-checklist"
      value="SYSTEM_DEFAULT"
      checked={selectedId === SYSTEM_DEFAULT_ID}
      disabled={isDisabled}
      onSelect={() => onSelect(SYSTEM_DEFAULT_ID)}
    />
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
        <ChecklistBundleCard
          key={item.checklistId}
          kind="option"
          title={item.name}
          description={`${item.itemCount}개 항목`}
          badge={
            currentId === item.checklistId ? '현재' : newlyCreatedId === item.checklistId ? '방금 생성' : undefined
          }
          name="active-checklist"
          value={String(item.checklistId)}
          checked={selectedId === item.checklistId}
          disabled={isDisabled}
          onSelect={() => onSelect(item.checklistId)}
        />
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
  options: css`
    label: ActiveChecklistOptions-options;
    display: grid;
    gap: 0.55rem;
    margin: 0;
    padding: 0;
    border: 0;
  `,
};

export default ActiveChecklistOptions;
