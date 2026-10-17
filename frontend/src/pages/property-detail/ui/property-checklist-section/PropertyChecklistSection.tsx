import { useEffect, useRef, useState } from 'react';

import PropertyChecklistItemControl from '@/pages/property-checklist/ui/property-checklist-item-control/PropertyChecklistItemControl';
import { useAssignActiveChecklist } from '@/features/checklist/api/useChecklistMutations';
import { clearLastSelectedChecklist, readLastSelectedChecklist } from '@/features/checklist/model/lastChecklistStore';
import ChecklistProgressBar from '@/features/checklist/ui/checklist-progress-bar/ChecklistProgressBar';
import { usePropertyChecklistDetail, usePropertyChecklistOverview } from '@/features/property/api/useProperties';
import { getChecklistStageLabel } from '@/features/property/lib/propertyFormat';
import type { PropertyChecklistItem } from '@/features/property/model/Property';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import DetailSection from '@/shared/ui/detail-section/DetailSection';
import Icon from '@/shared/ui/icon/Icon';

import styles from './PropertyChecklistSection.module.css';

type PropertyChecklistSectionProps = {
  propertyId: number;
};

const PropertyChecklistSection = ({ propertyId }: PropertyChecklistSectionProps) => {
  const checklists = usePropertyChecklistOverview(propertyId);
  const assignDefaultChecklist = useAssignActiveChecklist(propertyId, 'ON_SITE');
  const assignmentStarted = useRef(false);
  const [editingMemoItemId, setEditingMemoItemId] = useState<number | null>(null);
  const onSiteChecklist = checklists.data?.stages.find((item) => item.stage === 'ON_SITE');
  const propertyChecklistId = onSiteChecklist?.applied ? onSiteChecklist.propertyChecklistId : null;

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

  return (
    <>
      <DetailSection title="체크리스트">
        {onSiteChecklist !== undefined && onSiteChecklist.progress.totalCount > 0 && (
          <ChecklistProgressBar
            progress={onSiteChecklist.progress}
            trailing={
              <strong className={styles.count}>
                {onSiteChecklist.progress.completedCount}/{onSiteChecklist.progress.totalCount}
              </strong>
            }
          />
        )}
        {checklists.isError && (
          <button className={styles.retry} type="button" onClick={() => void checklists.refetch()}>
            체크리스트 정보를 불러오지 못했어요. 다시 시도
          </button>
        )}
        {assignDefaultChecklist.isError && (
          <p className={styles.retry}>체크리스트를 시작하지 못했어요. 다시 눌러 주세요.</p>
        )}
        {!checklists.isError && propertyChecklistId !== null ? (
          <AppliedChecklistItems
            propertyId={propertyId}
            propertyChecklistId={propertyChecklistId}
            editingMemoItemId={editingMemoItemId}
            onStartMemoEdit={setEditingMemoItemId}
            onFinishMemoEdit={() => setEditingMemoItemId(null)}
          />
        ) : (
          !checklists.isError && (
            <Button
              className={styles.mainAction}
              variant="primary"
              fullWidth
              isLoading={assignDefaultChecklist.isPending}
              loadingLabel="준비 중…"
              onClick={() => {
                void assignDefaultChecklist.mutateAsync('SYSTEM_DEFAULT').catch(() => undefined);
              }}
            >
              체크리스트
              <Icon name="arrow-right" size={16} />
            </Button>
          )
        )}
      </DetailSection>

      <div className={styles.contractSection}>
        <ButtonLink
          className={styles.contractAction}
          variant="secondary"
          fullWidth
          to={`/properties/${propertyId}/active-checklists/PRE_CONTRACT?from=property-detail`}
        >
          계약 시 체크리스트
          <Icon name="arrow-right" size={16} />
        </ButtonLink>
      </div>
    </>
  );
};

const AppliedChecklistItems = ({
  propertyId,
  propertyChecklistId,
  editingMemoItemId,
  onStartMemoEdit,
  onFinishMemoEdit,
}: {
  propertyId: number;
  propertyChecklistId: number;
  editingMemoItemId: number | null;
  onStartMemoEdit: (itemId: number) => void;
  onFinishMemoEdit: () => void;
}) => {
  const checklist = usePropertyChecklistDetail(propertyId, propertyChecklistId);

  if (checklist.isPending) {
    return <p className={styles.loading}>체크리스트를 불러오는 중이에요.</p>;
  }

  if (checklist.isError) {
    return (
      <button className={styles.retry} type="button" onClick={() => void checklist.refetch()}>
        체크리스트를 불러오지 못했어요. 다시 시도
      </button>
    );
  }

  const detail = checklist.data;
  const completedCount = detail.items.filter((item) => item.status !== 'UNCONFIRMED').length;

  return (
    <div className={styles.expandedChecklist}>
      <header className={styles.expandedHeader}>
        <div>
          <span>{getChecklistStageLabel(detail.stage)}</span>
          <h3>{detail.checklistName}</h3>
        </div>
        <strong>
          {completedCount}/{detail.items.length}
        </strong>
      </header>
      <ol className={styles.items}>
        {detail.items.map((item: PropertyChecklistItem) => (
          <PropertyChecklistItemControl
            key={item.itemId}
            propertyId={propertyId}
            propertyChecklistId={propertyChecklistId}
            item={item}
            isMemoEditing={editingMemoItemId === item.itemId}
            isMemoEditDisabled={editingMemoItemId !== null && editingMemoItemId !== item.itemId}
            onStartMemoEdit={() => onStartMemoEdit(item.itemId)}
            onFinishMemoEdit={onFinishMemoEdit}
          />
        ))}
      </ol>
    </div>
  );
};

export default PropertyChecklistSection;
