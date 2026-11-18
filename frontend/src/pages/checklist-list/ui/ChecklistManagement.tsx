import { css } from '@emotion/css';
import { useParams } from 'react-router-dom';

import { describeChecklistLoadError } from '@/features/checklist/api/checklistErrorMessages';
import { useChecklistList } from '@/features/checklist/api/useChecklists';
import { USER_CHECKLIST_STAGE } from '@/features/checklist/model/checklist';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { CHECKLIST_CREATE_PATH, checklistDetailPath, HOME_PATH } from '@/shared/lib/navigation/appPaths';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import QueryState from '@/shared/ui/query-state/QueryState';
import Skeleton from '@/shared/ui/skeleton/Skeleton';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

const describeError = describeChecklistLoadError('체크리스트를 불러오지 못했어요.', {});

const ChecklistManagement = () => {
  const list = useChecklistList(USER_CHECKLIST_STAGE);
  const params = useParams();
  const isDesktop = useIsDesktop();
  return (
    <main className={styles.page}>
      {/* 데스크탑은 공용 헤더가 있어 휴대폰용 뒤로가기 제목줄을 두지 않는다. */}
      {!isDesktop && <TopNavigation title="체크리스트 관리" backTo={HOME_PATH} backLabel="홈으로 돌아가기" />}
      <QueryState
        query={list}
        loadingTitle="체크리스트를 불러오는 중이에요."
        describeError={describeError}
        skeleton={
          <div className={styles.items}>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} shape="card" height="5rem" />
            ))}
          </div>
        }
      >
        {(data) => {
          const items = data.pages.flatMap((page) => page.content);
          return (
            <>
              <div className={styles.headingRow}>
                <h2 className={styles.heading}>
                  내 체크리스트 <span>{items.length}개</span>
                </h2>
                {items.length > 0 && (
                  <ButtonLink to={CHECKLIST_CREATE_PATH} className={styles.create}>
                    <Icon name="plus" size={14} /> 새 체크리스트
                  </ButtonLink>
                )}
              </div>
              {items.length === 0 ? (
                <div className={styles.emptyBox}>
                  <p className={styles.empty}>저장된 체크리스트가 없어요. 나만의 체크리스트를 만들어 보세요.</p>
                  <ButtonLink to={CHECKLIST_CREATE_PATH}>
                    <Icon name="plus" size={16} /> 새 체크리스트
                  </ButtonLink>
                </div>
              ) : (
                <ul className={styles.items}>
                  {items.map((item) => (
                    <li key={item.checklistId}>
                      <ButtonLink
                        to={checklistDetailPath(item.checklistId)}
                        variant="secondary"
                        fullWidth
                        className={styles.bundle}
                        aria-current={params.checklistId === String(item.checklistId) ? 'page' : undefined}
                      >
                        <Icon name="checklist" size={20} />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.itemCount}개 항목</small>
                        </span>
                        <Icon
                          name={params.checklistId === String(item.checklistId) ? 'edit' : 'chevron-right'}
                          size={16}
                        />
                      </ButtonLink>
                    </li>
                  ))}
                </ul>
              )}
              {list.hasNextPage && (
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                >
                  체크리스트 더 보기
                </Button>
              )}
            </>
          );
        }}
      </QueryState>
    </main>
  );
};

const styles = {
  page: css`
    label: ChecklistManagement-page;
    /* 셸이 이 화면에서는 선 색을 투명으로 두므로, 카드 테두리가 보이게 토큰의 진한 선 색을 쓴다. */
    --color-border: var(--color-border-strong);
    padding: 0 var(--checklist-gutter, 1.25rem) 2rem;

    @media (min-width: 1024px) {
      padding-inline: 0.5rem;
    }
    background: var(--color-canvas);
  `,
  /* 제목줄 오른쪽 끝에 작은 새 체크리스트 버튼을 둔다. */
  headingRow: css`
    label: ChecklistManagement-headingRow;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    margin: var(--space-md) 0 var(--space-sm);
  `,
  create: css`
    label: ChecklistManagement-create;
    flex: none;
    min-height: 2.75rem;
    padding: 0 0.85rem;
    font-size: 0.8125rem;
    & > span {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  `,
  heading: css`
    label: ChecklistManagement-heading;
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
  items: css`
    label: ChecklistManagement-items;
    display: grid;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  `,
  bundle: css`
    label: ChecklistManagement-bundle;
    padding: var(--space-sm) var(--space-md);
    min-height: 3.5rem;
    border-radius: 12px;
    text-align: left;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-sm);
    & > span {
      display: block;
      min-width: 0;
    }
    & strong,
    & small {
      display: block;
      overflow-wrap: anywhere;
    }
    & strong {
      font-size: 0.875rem;
      font-weight: 500;
    }
    & small {
      margin-top: 0.15rem;
      color: var(--color-muted);
      font-size: 0.75rem;
    }
    &[aria-current='page'] {
      background: var(--color-surface-muted);
      color: var(--color-ink);
    }
  `,
  /* 목록이 비었을 때만 안내 안에 큰 버튼을 둔다. */
  emptyBox: css`
    label: ChecklistManagement-emptyBox;
    display: grid;
    gap: var(--space-md);
    padding: var(--space-lg) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    text-align: center;
    justify-items: center;
    & a > span {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
  `,
  empty: css`
    label: ChecklistManagement-empty;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.875rem;
    line-height: 1.6;
    word-break: keep-all;
  `,
};

export default ChecklistManagement;
