import { useMemo } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { describeChecklistLoadError, getChecklistErrorMessage } from '@/features/checklist/api/checklistErrorMessages';
import { useAssignActiveChecklist } from '@/features/checklist/api/useChecklistMutations';
import { useChecklistList } from '@/features/checklist/api/useChecklists';
import { isChecklistStage } from '@/features/checklist/model/checklist';
import type { ChecklistStage } from '@/features/checklist/model/checklistTypes';
import ChecklistPageLayout from '@/features/checklist/ui/checklist-page-layout/ChecklistPageLayout';
import { usePropertyChecklistOverview, usePropertyDetail } from '@/features/property/api/useProperties';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import useReturnNavigation from '@/shared/lib/navigation/useReturnNavigation';
import BottomActionArea from '@/shared/ui/bottom-action-area/BottomActionArea';
import { Button } from '@/shared/ui/button/Button';
import ContentState from '@/shared/ui/content-state/ContentState';
import QueryState from '@/shared/ui/query-state/QueryState';

import useAutoOpenAppliedChecklist from './hooks/useAutoOpenAppliedChecklist';
import useChecklistSelection, { SYSTEM_DEFAULT_ID } from './hooks/useChecklistSelection';
import ActiveChecklistOptions from './ui/active-checklist-options/ActiveChecklistOptions';

import styles from './PropertyActiveChecklistPage.module.css';

const readNewChecklistId = (state: unknown): number | null => {
  if (typeof state !== 'object' || state === null || !('newChecklistId' in state)) return null;
  const value = state.newChecklistId;
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
};
const isFromPropertyDetail = (state: unknown) =>
  typeof state === 'object' && state !== null && 'from' in state && state.from === 'property-detail';

const backToList = <Link to="/">홈으로 돌아가기</Link>;
const describeError = describeChecklistLoadError('체크리스트를 불러오지 못했어요.', {
  PROPERTY_NOT_FOUND: '매물을 찾을 수 없어요.',
});

const ResolvedPropertyActiveChecklist = ({ propertyId, stage }: { propertyId: number; stage: ChecklistStage }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const property = usePropertyDetail(propertyId);
  const overview = usePropertyChecklistOverview(propertyId);
  const list = useChecklistList(stage);
  const assign = useAssignActiveChecklist(propertyId, stage);
  const newlyCreatedId = readNewChecklistId(location.state);
  const fromPropertyDetail = isFromPropertyDetail(location.state) || searchParams.get('from') === 'property-detail';
  const backToDetail = useReturnNavigation({
    cameFromTarget: fromPropertyDetail,
    fallback: `/properties/${propertyId}`,
  });
  const overviewStage = overview.data?.stages.find((item) => item.stage === stage);
  const appliedStage = overviewStage?.applied === true ? overviewStage : undefined;
  const isApplied = appliedStage !== undefined;
  const appliedPropertyChecklistId = appliedStage?.propertyChecklistId ?? null;
  const current =
    appliedStage !== undefined && appliedStage.checklistName !== null
      ? { checklistId: appliedStage.sourceChecklistId ?? SYSTEM_DEFAULT_ID, name: appliedStage.checklistName }
      : null;
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.content) ?? [], [list.data]);

  useAutoOpenAppliedChecklist({
    propertyId,
    assign,
    isReplacing: searchParams.get('mode') === 'replace',
    fromPropertyDetail,
    isOverviewReady: !overview.isPending && !overview.isError,
    isApplied,
    appliedPropertyChecklistId,
  });
  const selection = useChecklistSelection({
    propertyId,
    assign,
    fromPropertyDetail,
    initialSelectedId: newlyCreatedId,
    current,
    appliedPropertyChecklistId,
  });

  // 세 조회가 모두 끝나야 화면을 그릴 수 있으므로 하나의 조회처럼 묶어 QueryState에 넘긴다.
  const pageQuery = {
    isPending: property.isPending || overview.isPending || list.isPending,
    isError: property.isError || overview.isError || list.isError,
    error: property.error ?? overview.error ?? list.error,
    data: property.data,
    refetch: () => {
      void property.refetch();
      void overview.refetch();
      void list.refetch();
    },
  };
  const { selectedId, isSelectionChanged } = selection;

  return (
    <QueryState
      query={pageQuery}
      loadingTitle="체크리스트를 불러오는 중이에요."
      describeError={describeError}
      errorAction={backToList}
    >
      {(propertyDetail) => (
        <ChecklistPageLayout
          title="체크리스트 교체"
          onBack={backToDetail}
          backLabel="매물 상세로 돌아가기"
          className="property-page checklist-page active-checklist-page"
          containerClassName="page-container checklist-page__narrow"
        >
          <h1 className="sr-only">{propertyDetail.name} 체크리스트 교체</h1>
          <p className={styles.description}>이 매물에 적용할 체크리스트를 선택해요.</p>
          <ActiveChecklistOptions
            items={items}
            selectedId={selectedId}
            newlyCreatedId={newlyCreatedId}
            isDisabled={assign.isPending}
            onSelect={selection.toggleSelection}
          />
          {list.hasNextPage && (
            <div className={styles.loadMore}>
              {list.isFetchNextPageError && (
                <p role="alert">추가 목록을 불러오지 못했어요. 기존 선택지는 그대로 유지됩니다.</p>
              )}
              <Button
                variant="secondary"
                fullWidth
                type="button"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {list.isFetchingNextPage
                  ? '불러오는 중…'
                  : list.isFetchNextPageError
                    ? '다시 불러오기'
                    : '체크리스트 더 보기'}
              </Button>
            </div>
          )}
          {isSelectionChanged && current !== null && (
            <p className="form-notice">확인하면 현재 체크리스트가 선택한 체크리스트로 바뀝니다.</p>
          )}
          {assign.isError && (
            <p className="form-error" role="alert">
              {getChecklistErrorMessage(assign.error)} 기존 연결은 유지됩니다.
            </p>
          )}
          {selectedId !== null && isSelectionChanged && (
            <div className={styles.bottomAction}>
              <BottomActionArea divider={false}>
                <Button
                  variant="soft"
                  fullWidth
                  isLoading={assign.isPending}
                  loadingLabel="변경 중…"
                  type="button"
                  disabled={assign.isPending}
                  onClick={() => void selection.saveSelection()}
                >
                  {current === null ? '체크리스트 적용' : '선택한 체크리스트로 교체'}
                </Button>
              </BottomActionArea>
            </div>
          )}
        </ChecklistPageLayout>
      )}
    </QueryState>
  );
};

const PropertyActiveChecklistPage = () => {
  const params = useParams();
  const propertyId = parsePositiveId(params.propertyId);
  if (propertyId === null || !isChecklistStage(params.stage))
    return <ContentState title="올바른 매물 체크리스트 주소가 아니에요.">{backToList}</ContentState>;
  return <ResolvedPropertyActiveChecklist key={params.stage} propertyId={propertyId} stage={params.stage} />;
};
export default PropertyActiveChecklistPage;
