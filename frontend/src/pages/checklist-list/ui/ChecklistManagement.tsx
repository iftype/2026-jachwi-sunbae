import { css } from '@emotion/css';
import { useParams } from 'react-router-dom';

import { describeChecklistLoadError } from '@/features/checklist/api/checklistErrorMessages';
import { useChecklistList } from '@/features/checklist/api/useChecklists';
import { USER_CHECKLIST_STAGE } from '@/features/checklist/model/checklist';
import ChecklistBundleCard from '@/features/checklist/ui/checklist-bundle-card/ChecklistBundleCard';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { CHECKLIST_CREATE_PATH, checklistDetailPath, HOME_PATH } from '@/shared/lib/navigation/appPaths';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import DetailHeader from '@/shared/ui/detail-header/DetailHeader';
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
      {/* 데스크탑은 목록 칸의 머리줄(뒤로가기 없음), 휴대폰은 뒤로가기 제목줄을 쓴다. */}
      {isDesktop ? (
        <DetailHeader title="체크리스트" backLabel="홈으로 돌아가기" onBack={() => undefined} hasBackButton={false} />
      ) : (
        <TopNavigation title="체크리스트 관리" backTo={HOME_PATH} backLabel="홈으로 돌아가기" />
      )}
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
                  <ButtonLink to={CHECKLIST_CREATE_PATH} variant="neutral" className={styles.create}>
                    <Icon name="plus" size={14} /> 새 체크리스트
                  </ButtonLink>
                )}
              </div>
              {items.length === 0 ? (
                <div className={styles.emptyBox}>
                  <p className={styles.empty}>저장된 체크리스트가 없어요. 나만의 체크리스트를 만들어 보세요.</p>
                  <ButtonLink to={CHECKLIST_CREATE_PATH} variant="neutral" className={styles.create}>
                    <Icon name="plus" size={14} /> 새 체크리스트
                  </ButtonLink>
                </div>
              ) : (
                <ul className={styles.items}>
                  {items.map((item) => (
                    <li key={item.checklistId}>
                      <ChecklistBundleCard
                        kind="link"
                        to={checklistDetailPath(item.checklistId)}
                        title={item.name}
                        description={`${item.itemCount}개 항목`}
                        isCurrent={params.checklistId === String(item.checklistId)}
                      />
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
    padding: 0.4rem 0.8rem;
    min-height: 2.25rem;
    font-size: 0.75rem;
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
  /* 목록이 비었을 때만 안내 안에 큰 버튼을 둔다. */
  emptyBox: css`
    label: ChecklistManagement-emptyBox;
    display: grid;
    gap: var(--space-md);
    padding: 1.25rem 1rem;
    border-radius: 1rem;
    background: var(--color-card-surface);
    justify-items: start;
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
