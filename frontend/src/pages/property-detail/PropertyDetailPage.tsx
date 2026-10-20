import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import PropertyAdditionalInfoForm from '@/pages/property-memo/ui/property-additional-info-form/PropertyAdditionalInfoForm';
import { describePropertyLoadError } from '@/features/property/api/propertyErrorMessages';
import { usePropertyDetail } from '@/features/property/api/useProperties';
import { useRemoveProperty } from '@/features/property/api/usePropertyMutations';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import {
  getPropertyReturnPath,
  getPropertyReturnState,
  type PropertyReturnPath,
} from '@/features/property/lib/propertyNavigation';
import type { PropertyDetail } from '@/features/property/model/Property';
import PropertyPhotoViewer from '@/features/property/ui/property-photo-viewer/PropertyPhotoViewer';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import ContentState from '@/shared/ui/content-state/ContentState';
import Icon from '@/shared/ui/icon/Icon';
import QueryState from '@/shared/ui/query-state/QueryState';
import TopNavigationMenu from '@/shared/ui/top-navigation-menu/TopNavigationMenu';

import PropertyAdditionalInfoSection from './ui/property-additional-info-section/PropertyAdditionalInfoSection';
import PropertyBasicInfoForm from './ui/property-basic-info-section/PropertyBasicInfoForm';
import PropertyBasicInfoSection from './ui/property-basic-info-section/PropertyBasicInfoSection';
import PropertyChecklistSection from './ui/property-checklist-section/PropertyChecklistSection';
import PropertyEditSheet from './ui/property-edit-sheet/PropertyEditSheet';
import PropertyHeroPhoto from './ui/property-hero-photo/PropertyHeroPhoto';
import PropertyMemoSection from './ui/property-memo-section/PropertyMemoSection';
import PropertyPhotoSection from './ui/property-photo-section/PropertyPhotoSection';

import styles from './PropertyDetailPage.module.css';

const describeError = describePropertyLoadError('매물 상세를 불러오지 못했어요.');

/** 다른 화면 옆 패널로 열 때 쓴다. 보여줄 매물과 닫기(뒤로가기·삭제 뒤)를 패널을 연 화면이 정한다. */
export type PropertyDetailPanel = { propertyId: number; onClose: () => void };

type PropertyDetailViewProps = {
  propertyId: number;
  detail: PropertyDetail;
  backTo: PropertyReturnPath;
  panel?: PropertyDetailPanel;
};

type PropertyDetailPageProps = {
  panel?: PropertyDetailPanel;
  /** 들어온 화면을 알 수 없을 때(주소 직접 입력 등) 돌아갈 화면. 기본은 기록 화면이다. */
  returnTo?: PropertyReturnPath;
};

const PropertyDetailPage = ({ panel, returnTo }: PropertyDetailPageProps) => {
  const routePropertyId = parsePositiveId(useParams().propertyId);
  const propertyId = panel?.propertyId ?? routePropertyId;
  const backTo = getPropertyReturnPath(useLocation().state, returnTo);
  if (propertyId === null) {
    return (
      <ContentState title="올바른 매물 주소가 아니에요.">
        <Link to={backTo}>
          {backTo === '/map'
            ? '매물 지도로 돌아가기'
            : backTo === '/properties'
              ? '기록 화면으로 돌아가기'
              : '홈으로 돌아가기'}
        </Link>
      </ContentState>
    );
  }
  return <ResolvedPropertyDetailPage propertyId={propertyId} backTo={backTo} panel={panel} />;
};

const ResolvedPropertyDetailPage = ({
  propertyId,
  backTo,
  panel,
}: {
  propertyId: number;
  backTo: PropertyReturnPath;
  panel?: PropertyDetailPanel;
}) => {
  const property = usePropertyDetail(propertyId);

  return (
    <QueryState
      query={property}
      loadingTitle="매물 상세를 불러오는 중이에요."
      describeError={describeError}
      errorAction={
        <Link to={backTo}>
          {backTo === '/map'
            ? '매물 지도로 돌아가기'
            : backTo === '/properties'
              ? '기록 화면으로 돌아가기'
              : '홈으로 돌아가기'}
        </Link>
      }
    >
      {(detail) => <PropertyDetailView propertyId={propertyId} detail={detail} backTo={backTo} panel={panel} />}
    </QueryState>
  );
};

const PropertyDetailView = ({ propertyId, detail, backTo, panel }: PropertyDetailViewProps) => {
  const navigate = useNavigate();
  const returnState = getPropertyReturnState(useLocation().state);
  const removeMutation = useRemoveProperty(propertyId);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist'>('details');
  const [editingSection, setEditingSection] = useState<'basic' | 'additional' | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const photoTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    trackPostHogEvent('property_detail_viewed', { property_id: propertyId });
  }, [propertyId]);

  const Root = panel ? 'div' : 'main';

  const deleteProperty = async () => {
    try {
      await removeMutation.mutateAsync();
      setIsDeleteDialogOpen(false);
      if (panel) panel.onClose();
      else navigate(backTo, { replace: true, state: { focusHeading: true } });
    } catch {
      // 삭제 확인 창에서 재시도할 수 있도록 유지한다.
    }
  };

  return (
    // 패널로 열면 패널을 연 화면의 main 안에 들어가므로 main을 겹치지 않는다.
    <Root className={styles.page} data-panel={panel ? 'true' : undefined}>
      <div className={styles.container}>
        <header className={styles.header}>
          {panel ? (
            <button className={styles.backButton} type="button" aria-label="목록으로 돌아가기" onClick={panel.onClose}>
              <Icon name="chevron-left" size={24} />
            </button>
          ) : (
            <Link
              className={styles.backButton}
              to={backTo}
              state={returnState}
              aria-label={
                backTo === '/map'
                  ? '매물 지도로 돌아가기'
                  : backTo === '/properties'
                    ? '기록 화면으로 돌아가기'
                    : '홈으로 돌아가기'
              }
            >
              <Icon name="chevron-left" size={24} />
            </Link>
          )}
          <h1 className={styles.headerTitle}>{detail.name}</h1>
        </header>

        <nav className={styles.tabs} role="tablist" aria-label="매물 상세 메뉴">
          <button
            id="property-details-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            aria-controls="property-details-panel"
            onClick={() => setActiveTab('details')}
          >
            정보
          </button>
          <button
            id="property-checklist-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'checklist'}
            aria-controls="property-checklist-panel"
            onClick={() => setActiveTab('checklist')}
          >
            체크리스트
          </button>
        </nav>

        {activeTab === 'details' ? (
          <section id="property-details-panel" role="tabpanel" aria-labelledby="property-details-tab">
            <PropertyHeroPhoto
              propertyId={propertyId}
              propertyName={detail.name}
              photos={detail.photoPreview.photos}
              backTo={backTo}
              backState={returnState}
              showBackButton={false}
              onOpen={() => {
                photoTriggerRef.current = null;
                setSelectedPhotoIndex(0);
              }}
            />
            <div className={styles.infoPanel}>
              <div className={styles.titleRow}>
                {/* 화면 제목(h1)은 헤더가 맡고, 정보 탭의 이름은 같은 내용을 크게 다시 보여준다. */}
                <p className={styles.infoTitle}>{detail.name}</p>
                <TopNavigationMenu label="매물 정보 메뉴 열기">
                  <button
                    ref={deleteButtonRef}
                    type="button"
                    data-tone="danger"
                    onClick={() => {
                      removeMutation.reset();
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    삭제
                  </button>
                </TopNavigationMenu>
              </div>
              <PropertyBasicInfoSection property={detail} onEdit={() => setEditingSection('basic')} />

              <PropertyAdditionalInfoSection property={detail} onEdit={() => setEditingSection('additional')} />

              <PropertyMemoSection propertyId={propertyId} />

              <PropertyPhotoSection
                propertyId={propertyId}
                propertyName={detail.name}
                photoPreview={detail.photoPreview}
                onSelect={(index, trigger) => {
                  photoTriggerRef.current = trigger;
                  setSelectedPhotoIndex(index);
                }}
              />
            </div>
          </section>
        ) : (
          <section id="property-checklist-panel" role="tabpanel" aria-labelledby="property-checklist-tab">
            <PropertyChecklistSection propertyId={propertyId} />
          </section>
        )}

        {selectedPhotoIndex !== null && (
          <PropertyPhotoViewer
            propertyId={propertyId}
            propertyName={detail.name}
            initialIndex={selectedPhotoIndex}
            onClose={() => {
              setSelectedPhotoIndex(null);
              window.requestAnimationFrame(() => photoTriggerRef.current?.focus());
            }}
          />
        )}

        {editingSection !== null && (
          <PropertyEditSheet
            title={editingSection === 'basic' ? '기본 정보 수정' : '부가 정보 수정'}
            initialHeightPercent={88}
            onClose={() => setEditingSection(null)}
          >
            {editingSection === 'basic' ? (
              <PropertyBasicInfoForm property={detail} onSaved={() => setEditingSection(null)} />
            ) : (
              <PropertyAdditionalInfoForm property={detail} layout="sheet" onSaved={() => setEditingSection(null)} />
            )}
          </PropertyEditSheet>
        )}

        <ConfirmDialog
          isOpen={isDeleteDialogOpen}
          title={`${detail.name}을 삭제할까요?`}
          description="삭제한 매물은 되돌릴 수 없습니다."
          confirmLabel="매물 삭제"
          isConfirming={removeMutation.isPending}
          returnFocusRef={deleteButtonRef}
          onCancel={() => setIsDeleteDialogOpen(false)}
          onConfirm={() => void deleteProperty()}
        >
          {removeMutation.isError && (
            <p role="alert" className={styles.deleteError}>
              매물을 삭제하지 못했습니다. 매물은 그대로 유지됩니다.
            </p>
          )}
        </ConfirmDialog>
      </div>
    </Root>
  );
};

export default PropertyDetailPage;
