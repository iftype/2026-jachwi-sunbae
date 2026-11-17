import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAssignActiveChecklist } from '@/features/checklist/api/useChecklistMutations';
import { clearLastSelectedChecklist, readLastSelectedChecklist } from '@/features/checklist/model/lastChecklistStore';
import ChecklistProgressRing from '@/features/checklist/ui/checklist-progress-ring/ChecklistProgressRing';
import { orPreview, previewPropertyChecklistDetail } from '@/features/property/api/previewPropertyApi';
import { fetchPropertyChecklistDetail } from '@/features/property/api/propertyApi';
import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import { usePropertyChecklistOverview } from '@/features/property/api/useProperties';
import type { PropertyChecklistDetail, PropertyChecklistProgress } from '@/features/property/model/Property';
import PropertyChecklist from '@/features/property/ui/property-checklist/PropertyChecklist';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { Button } from '@/shared/ui/button/Button';
import DelayedFallback from '@/shared/ui/delayed-fallback/DelayedFallback';
import DetailSection from '@/shared/ui/detail-section/DetailSection';
import Icon from '@/shared/ui/icon/Icon';

import * as styles from './PropertyChecklistSection.styles';

type PropertyChecklistSectionProps = {
  propertyId: number;
};

const PropertyChecklistSection = ({ propertyId }: PropertyChecklistSectionProps) => {
  const checklists = usePropertyChecklistOverview(propertyId);
  const assignDefaultChecklist = useAssignActiveChecklist(propertyId, 'ON_SITE');
  const assignmentStarted = useRef(false);
  const onSiteChecklist = checklists.data?.stages.find((item) => item.stage === 'ON_SITE');
  const propertyChecklistId = onSiteChecklist?.applied ? onSiteChecklist.propertyChecklistId : null;
  const config = usePublicConfig();
  // `usePropertyChecklistDetail`과 같은 조회다. 적용된 체크리스트 ID를 알기 전에는 보내지 않아야 해서 여기서 `enabled`를 붙여 부른다.
  // 두 조회를 한 컴포넌트에서 보아야 로딩 UI 하나로 기다릴 수 있다.
  const checklist = useQuery({
    queryKey: propertyQueryKeys.checklist(propertyId, propertyChecklistId ?? 0),
    queryFn: ({ signal }) =>
      orPreview(propertyId, previewPropertyChecklistDetail, () =>
        fetchPropertyChecklistDetail(config, propertyId, propertyChecklistId ?? 0, signal),
      ),
    enabled: propertyChecklistId !== null,
  });

  useEffect(() => {
    if (
      checklists.isPending ||
      checklists.isError ||
      checklists.data === undefined ||
      onSiteChecklist?.applied === true ||
      assignmentStarted.current
    ) {
      return;
    }

    assignmentStarted.current = true;
    const remembered = readLastSelectedChecklist();
    void assignDefaultChecklist.mutateAsync(remembered).catch(() => {
      if (remembered === 'SYSTEM_DEFAULT') return;
      clearLastSelectedChecklist();
      void assignDefaultChecklist.mutateAsync('SYSTEM_DEFAULT').catch(() => undefined);
    });
  }, [assignDefaultChecklist, checklists.data, checklists.isError, checklists.isPending, onSiteChecklist?.applied]);

  const isApplied = !checklists.isError && propertyChecklistId !== null;
  // 적용 여부를 아직 모르거나, 적용 안 된 매물에 기본 체크리스트를 자동으로 붙이는 중이면 시작 버튼을 그리지 않고 기다린다.
  // 요청 중에 시작 버튼을 그리면 응답이 오자마자 사라져 깜빡인다.
  // 적용된 뒤에는 항목까지 받아야 그린다. 두 기다림을 하나로 묶어, 중간에 로딩 UI가 사라졌다 다시 나타나지 않게 한다.
  const isPending =
    checklists.isPending ||
    (!checklists.isError && !isApplied && (assignDefaultChecklist.isIdle || assignDefaultChecklist.isPending)) ||
    (isApplied && checklist.isPending);

  return (
    <DetailSection title="체크리스트">
      {checklists.isError && (
        <button className={styles.retry} type="button" onClick={() => void checklists.refetch()}>
          체크리스트 정보를 불러오지 못했어요. 다시 시도
        </button>
      )}
      {assignDefaultChecklist.isError && (
        <p className={styles.retry}>체크리스트를 시작하지 못했어요. 다시 눌러 주세요.</p>
      )}
      {!checklists.isError && (
        // 빠른 응답에는 스켈레톤 없이 바로 내용을 보여 주고, 오래 걸릴 때만 스켈레톤을 띄운다.
        // 기다리는 동안에는 스켈레톤과 같은 크기의 빈자리를 두어, 내용이 들어올 때 아래가 밀리지 않게 한다.
        <DelayedFallback
          isPending={isPending}
          fallback={<ChecklistSkeleton />}
          placeholder={<ChecklistSkeleton isPlaceholder />}
        >
          {() =>
            isApplied && propertyChecklistId !== null ? (
              checklist.isError || checklist.data === undefined ? (
                <button className={styles.retry} type="button" onClick={() => void checklist.refetch()}>
                  체크리스트를 불러오지 못했어요. 다시 시도
                </button>
              ) : (
                <AppliedChecklistItems
                  propertyId={propertyId}
                  propertyChecklistId={propertyChecklistId}
                  detail={checklist.data}
                  progress={onSiteChecklist?.progress}
                />
              )
            ) : (
              <Button
                className={styles.mainAction}
                variant="primary"
                fullWidth
                onClick={() => {
                  void assignDefaultChecklist.mutateAsync('SYSTEM_DEFAULT').catch(() => undefined);
                }}
              >
                체크리스트
                <Icon name="arrow-right" size={16} />
              </Button>
            )
          }
        </DelayedFallback>
      )}
    </DetailSection>
  );
};

/**
 * 진행 링과 기본 체크리스트 네 항목과 같은 모양의 스켈레톤.
 * `isPlaceholder`면 보이지 않는 같은 크기의 빈자리로 쓴다.
 */
const ChecklistSkeleton = ({ isPlaceholder = false }: { isPlaceholder?: boolean }) => (
  <div
    className={isPlaceholder ? styles.skeletonPlaceholder : undefined}
    role={isPlaceholder ? undefined : 'status'}
    aria-hidden={isPlaceholder || undefined}
  >
    {!isPlaceholder && <span className="sr-only">체크리스트를 불러오는 중이에요.</span>}
    {/* 회색 탭 바탕 위의 흰 카드들(머리와 진행 링, 카테고리)과 같은 구조로 그린다. */}
    <div className={styles.skeletonStack} aria-hidden="true">
      <div className={styles.skeletonCard}>
        <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <div className={styles.skeletonSummary}>
          <span className={`${styles.skeleton} ${styles.skeletonRing}`} />
          <span className={styles.skeletonLegend}>
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
          </span>
        </div>
      </div>
      {[0, 1].map((card) => (
        <div key={card} className={styles.skeletonCard}>
          <span className={`${styles.skeleton} ${styles.skeletonCategory}`} />
          <ul className={styles.skeletonItems}>
            {[0, 1].map((index) => (
              <li key={index}>
                <span className={styles.skeleton} />
                <span className={`${styles.skeleton} ${styles.skeletonAction}`} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

/** 진행 링과 항목을 함께 그려, 링이 먼저 나타나 자리를 밀지 않게 한다. */
const AppliedChecklistItems = ({
  propertyId,
  propertyChecklistId,
  detail,
  progress,
}: {
  propertyId: number;
  propertyChecklistId: number;
  detail: PropertyChecklistDetail;
  progress: PropertyChecklistProgress | undefined;
}) => {
  return (
    <>
      <PropertyChecklist
        key={propertyChecklistId}
        propertyId={propertyId}
        detail={detail}
        summary={
          progress !== undefined && progress.totalCount > 0 ? <ChecklistProgressRing progress={progress} /> : undefined
        }
      />
    </>
  );
};

export default PropertyChecklistSection;
