import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { USER_CHECKLIST_STAGE } from '@/features/checklist/model/checklist';
import { propertyActiveChecklistPath } from '@/shared/lib/navigation/appPaths';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';

import { groupPropertyChecklistItems } from '../../lib/propertyChecklistGroups';
import type { PropertyChecklistDetail } from '../../model/Property';
import { isPreviewProperty } from '../../model/sampleProperties';
import PropertyChecklistItemControl from './PropertyChecklistItemControl';

type PropertyChecklistProps = {
  readonly propertyId: number;
  readonly detail: PropertyChecklistDetail;
  readonly replaceNavigation?: boolean;
  readonly fromPropertyDetail?: boolean;
  /** 머리 카드 안, 제목 아래에 같이 둘 요약(진행 링 등). 주면 평가한 수는 요약 오른쪽 끝에 크게 둔다. */
  readonly summary?: ReactNode;
};

const PropertyChecklist = ({
  propertyId,
  detail,
  replaceNavigation = false,
  fromPropertyDetail = true,
  summary,
}: PropertyChecklistProps) => {
  const id = useId();
  const completedCount = detail.items.filter((item) => item.status !== 'UNCONFIRMED').length;
  const groups = groupPropertyChecklistItems(detail.items, detail.stage);

  const count = (
    <span role="status" className={summary === undefined ? undefined : 'sr-only'}>
      <span aria-hidden="true">
        {completedCount}/{detail.items.length}
      </span>
      <span className="sr-only">
        {detail.items.length}개 중 {completedCount}개 평가
      </span>
    </span>
  );

  return (
    <section className={styles.checklist} aria-labelledby={`${id}-title`}>
      <header className={styles.headerCard}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h2 id={`${id}-title`}>사용자 체크리스트</h2>
            {detail.stage === USER_CHECKLIST_STAGE &&
              (isPreviewProperty(propertyId) ? (
                <Button
                  variant="neutral"
                  className={styles.replaceAction}
                  disabled
                  aria-label="미리보기 체크리스트는 교체할 수 없어요"
                >
                  교체
                </Button>
              ) : (
                <ButtonLink
                  variant="neutral"
                  className={styles.replaceAction}
                  to={`${propertyActiveChecklistPath(propertyId, detail.stage)}?mode=replace`}
                  replace={replaceNavigation}
                  state={fromPropertyDetail ? { from: 'property-detail' } : undefined}
                  aria-label="사용자 체크리스트 교체"
                >
                  <Icon name="replace" size={14} />
                  교체
                </ButtonLink>
              ))}
          </div>
          {summary === undefined && count}
        </div>
        {summary !== undefined && (
          <div className={styles.summaryRow}>
            {summary}
            {count}
          </div>
        )}
      </header>
      {groups.map((group, index) => (
        <section className={styles.group} key={group.name} aria-labelledby={`${id}-category-${index}`}>
          <h3 id={`${id}-category-${index}`}>
            <span className={styles.categoryIcon} aria-hidden="true">
              <Icon name={group.icon} size={18} />
            </span>
            <span className={styles.categoryName}>{group.name}</span>
          </h3>
          <ol className={styles.items}>
            {group.items.map((item) => (
              <PropertyChecklistItemControl
                key={item.itemId}
                propertyId={propertyId}
                propertyChecklistId={detail.propertyChecklistId}
                item={item}
              />
            ))}
          </ol>
        </section>
      ))}
      {detail.items.length === 0 && <p className={styles.empty}>체크리스트 항목이 없어요.</p>}
    </section>
  );
};

const styles = {
  checklist: css`
    label: PropertyChecklist-checklist;
    --color-surface: var(--color-canvas);
    --color-border: color-mix(in srgb, var(--color-border-strong) 60%, var(--color-canvas));
    /* 머리 카드(제목과 요약)와 섹션(카테고리)마다 흰 카드를 따로 두고, 사이에 회색 바탕이 보이게 띄운다. */
    display: grid;
    gap: 0.5rem;
    margin-top: 0;
    min-width: 0;
  `,
  headerCard: css`
    label: PropertyChecklist-headerCard;
    padding: 0 1rem 1rem;
    background: var(--color-canvas);
  `,
  summaryRow: css`
    label: PropertyChecklist-summaryRow;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    /* 진행 링 자체의 위쪽 여백은 카드가 이미 가지므로 없앤다. */
    & > :first-child {
      margin-top: 0;
    }
  `,
  header: css`
    label: PropertyChecklist-header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: 0.95rem 0 0.4rem;
    & h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
    }
    & > span {
      flex: none;
      color: var(--color-muted);
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
    }
  `,
  titleRow: css`
    label: PropertyChecklist-titleRow;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  `,
  replaceAction: css`
    label: PropertyChecklist-replaceAction;
    min-height: 2.25rem;
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    font-size: 0.75rem;
    & > span {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  `,
  group: css`
    label: PropertyChecklist-group;
    /* 섹션(카테고리)마다 따로 떨어진 흰 카드. 사이에는 선 대신 회색 바탕이 보인다. */
    padding: 0 1rem 0.3rem;
    background: var(--color-canvas);
    & h3 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      padding: 0.9rem 0 0.2rem;
      font-size: 0.9375rem;
      font-weight: 750;
    }
  `,
  /* 카테고리 이름 앞에는 아이콘만 둔다. */
  /* 카테고리 이름 옆 아이콘은 모양은 그대로 두고 색만 우리 파랑으로 둔다. */
  categoryIcon: css`
    label: PropertyChecklist-categoryIcon;
    display: inline-flex;
    flex: none;
    color: var(--color-brand-blue-ink);
  `,
  categoryName: css`
    label: PropertyChecklist-categoryName;
    flex: 1;
    min-width: 0;
  `,
  items: css`
    label: PropertyChecklist-items;
    margin: 0;
    padding: 0;
    list-style: none;
  `,
  empty: css`
    label: PropertyChecklist-empty;
    color: var(--color-muted);
    font-size: 0.875rem;
  `,
};

export default PropertyChecklist;
