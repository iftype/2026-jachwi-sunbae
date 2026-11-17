import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { MapAddress } from '@/features/map/model/Map';
import { describePropertyLoadError } from '@/features/property/api/propertyErrorMessages';
import { usePropertyDetail } from '@/features/property/api/useProperties';
import { useRemoveProperty, useUpdateProperty } from '@/features/property/api/usePropertyMutations';
import {
  getPropertyReturnPath,
  getPropertyReturnState,
  hasPropertyReturnPath,
  type PropertyReturnPath,
} from '@/features/property/lib/propertyNavigation';
import type { PropertyDetail } from '@/features/property/model/Property';
import { parsePropertyRouteId } from '@/features/property/model/sampleProperties';
import PropertyPhotoManager from '@/features/property/ui/property-photo-manager/PropertyPhotoManager';
import PropertyPhotoViewer from '@/features/property/ui/property-photo-viewer/PropertyPhotoViewer';
import { LogScreen } from '@/shared/lib/analytics/logging';
import useDocumentTitle from '@/shared/lib/hooks/useDocumentTitle';
import { MAP_SELECT_LOCATION_PATH, PROPERTY_DETAIL_TAB_PARAM, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import useReturnNavigation from '@/shared/lib/navigation/useReturnNavigation';
import ContentState from '@/shared/ui/content-state/ContentState';
import DetailHeader from '@/shared/ui/detail-header/DetailHeader';
import Icon from '@/shared/ui/icon/Icon';
import QueryState from '@/shared/ui/query-state/QueryState';
import TopNavigationMenu from '@/shared/ui/top-navigation-menu/TopNavigationMenu';

import { type DetailTab, parseDetailTab } from './model/detailTab';
import type { PropertyEditField } from './model/editField';
import { readLastDetailTab, writeLastDetailTab } from './model/lastDetailTab';
import PropertyDetailSkeleton from './PropertyDetailSkeleton';
import PreviewNotSavedToast from './ui/PreviewNotSavedToast';
import PropertyAdditionalInfoSection from './ui/property-additional-info-section/PropertyAdditionalInfoSection';
import PropertyBasicInfoSection from './ui/property-basic-info-section/PropertyBasicInfoSection';
import PropertyChecklistSection from './ui/property-checklist-section/PropertyChecklistSection';
import PropertyHeroPhoto from './ui/property-hero-photo/PropertyHeroPhoto';
import PropertyMemoSection from './ui/property-memo-section/PropertyMemoSection';
import PropertyNearbyPreview from './ui/property-nearby-preview/PropertyNearbyPreview';
import PropertyPhotoSection from './ui/property-photo-section/PropertyPhotoSection';

const describeError = describePropertyLoadError('매물 상세를 불러오지 못했어요.');
/** 저장한 줄에 `저장했어요`를 보여 두는 시간. */
const SAVED_FEEDBACK_MS = 2400;

/** 다른 화면 옆 패널로 열 때 쓴다. 보여줄 매물과 닫기(뒤로가기·삭제 뒤)를 패널을 연 화면이 정한다. */
export type PropertyDetailPanel = {
  propertyId: number;
  onClose: () => void;
  /** 머리의 제목 오른쪽에 둘 것. 본 방 기록은 앞뒤 매물로 넘기는 화살표를 둔다. */
  headerEnd?: ReactNode;
};

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
  const routePropertyId = parsePropertyRouteId(useParams().propertyId);
  const propertyId = panel?.propertyId ?? routePropertyId;
  const backTo = getPropertyReturnPath(useLocation().state, returnTo);
  if (propertyId === null) {
    return (
      <ContentState title="올바른 매물 주소가 아니에요.">
        <Link to={backTo}>{backTo === RECORDS_PATH ? '기록 화면으로 돌아가기' : '홈으로 돌아가기'}</Link>
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
      skeleton={<PropertyDetailSkeleton />}
      // 옆 칸으로 열었을 때는 이전, 다음으로 매물을 넘기며 다시 불러오므로, 빠른 응답에는 뼈대를 띄우지 않는다.
      delayLoading={panel !== undefined}
      describeError={describeError}
      errorAction={<Link to={backTo}>{backTo === RECORDS_PATH ? '기록 화면으로 돌아가기' : '홈으로 돌아가기'}</Link>}
    >
      {/* 상세를 불러온 뒤 매물마다 한 번 진입 로그를 남긴다. 다른 매물로 바뀌면 key가 바뀌어 다시 남긴다. */}
      {(detail) => (
        <LogScreen key={propertyId} event="property_detail_viewed" params={{ property_id: propertyId }}>
          <PropertyDetailView propertyId={propertyId} detail={detail} backTo={backTo} panel={panel} />
        </LogScreen>
      )}
    </QueryState>
  );
};

const PropertyDetailView = ({ propertyId, detail, backTo, panel }: PropertyDetailViewProps) => {
  const navigate = useNavigate();
  const locationState = useLocation().state;
  const returnState = getPropertyReturnState(locationState);
  const goBack = useReturnNavigation({
    cameFromTarget: hasPropertyReturnPath(locationState),
    fallback: backTo,
    fallbackState: returnState,
  });
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabInUrl = parseDetailTab(searchParams.get(PROPERTY_DETAIL_TAB_PARAM));
  // 주소에 탭이 없으면 이 매물에서 마지막으로 본 탭을 연다. 처음 보는 매물은 정보부터 연다.
  const [rememberedTab] = useState(() => readLastDetailTab(propertyId));
  const activeTab = tabInUrl ?? rememberedTab ?? 'details';
  useEffect(() => {
    writeLastDetailTab(propertyId, activeTab);
  }, [propertyId, activeTab]);
  // 고른 탭을 주소에 남겨 교체 후에는 체크리스트 탭으로 돌아오고, 탭 없는 새 진입은 정보부터 연다.
  // 들어온 화면(state)은 그대로 둔다.
  const setActiveTab = (next: DetailTab) => {
    setSearchParams(
      (current) => {
        current.set(PROPERTY_DETAIL_TAB_PARAM, next);
        return current;
      },
      { replace: true, state: locationState },
    );
  };
  // 탭 제목으로 어느 매물의 어느 탭인지 먼저 알린다. 패널로 열면 패널을 연 기록 화면이 탭 제목을 가진다.
  useDocumentTitle(panel ? undefined : `${detail.name} ${activeTab === 'checklist' ? '체크리스트' : '정보'}`);
  // 그 줄 안에서 고치고 있는 항목. 모달 없이 상세 화면에서 바로 고치고, 한 번에 한 줄만 연다.
  const [editingField, setEditingField] = useState<PropertyEditField | null>(null);
  // 방금 저장한 항목. 그 줄 값 아래에 잠깐 `저장했어요`를 보여 응답한다.
  const [savedField, setSavedField] = useState<PropertyEditField | null>(null);
  useEffect(() => {
    if (savedField === null) return;
    const timer = window.setTimeout(() => setSavedField(null), SAVED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [savedField]);
  const inlineEdit = {
    editingField,
    savedField,
    onEdit: (field: PropertyEditField) => {
      setSavedField(null);
      setEditingField(field);
    },
    // 고치던 줄을 떠나 다른 줄을 누르면, 앞 줄 저장이 끝나기 전에 새 줄이 열린다. 저장을 마친 줄만 닫는다.
    onSaved: (field: PropertyEditField) => {
      setEditingField((current) => (current === field ? null : current));
      setSavedField(field);
    },
    onCancel: () => setEditingField(null),
  };
  // 위치가 있으면 아래 주변 환경 지도를 눌러 바로 바꾼다. 위치가 아직 없으면 지도 화면으로 가서 고른다.
  const currentLocation = useLocation();
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const updateLocation = useUpdateProperty(propertyId);
  const hasCoordinates = detail.location.latitude !== null && detail.location.longitude !== null;
  const saveLocation = async (selected: MapAddress) => {
    const address = selected.roadAddress ?? selected.jibunAddress ?? selected.address ?? '';
    await updateLocation.mutateAsync({
      current: detail,
      changes: { address, latitude: selected.latitude, longitude: selected.longitude },
    });
  };
  const editLocation = () =>
    hasCoordinates
      ? setIsEditingLocation(true)
      : navigate(MAP_SELECT_LOCATION_PATH, {
          state: { returnTo: `${currentLocation.pathname}${currentLocation.search}`, propertyId },
        });
  // 삭제는 ⋮ 메뉴 안에 있어 잘못 누를 일이 적으므로 확인을 묻지 않고 바로 지운다.
  const removeProperty = useRemoveProperty(propertyId);
  const photoTriggerRef = useRef<HTMLButtonElement | null>(null);
  // 옆 칸(데스크탑 본 방 기록)으로 열었으면 사진 관리도 화면을 옮기지 않고 이 칸 안에서 연다. 지도와 리스트가 그대로 남는다.
  const [isManagingPhotos, setIsManagingPhotos] = useState(false);
  const managePhotos = panel ? () => setIsManagingPhotos(true) : undefined;

  const Root = panel ? 'div' : 'main';

  // 삭제를 마치면 옆 칸으로 연 경우는 칸을 닫고, 따로 연 화면은 돌아갈 곳으로 이동한다.
  const afterDelete = () => {
    if (panel) panel.onClose();
    else navigate(backTo, { replace: true, state: { focusHeading: true } });
  };

  if (panel && isManagingPhotos)
    return (
      <div className={styles.page} data-panel="true">
        <div className={styles.container}>
          <DetailHeader
            title={`${detail.name} · 사진`}
            onBack={() => setIsManagingPhotos(false)}
            backLabel="매물 상세로 돌아가기"
          />
          <PropertyPhotoManager propertyId={propertyId} />
        </div>
      </div>
    );

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
              onClick={(event) => {
                event.preventDefault();
                goBack();
              }}
              aria-label={backTo === RECORDS_PATH ? '기록 화면으로 돌아가기' : '홈으로 돌아가기'}
            >
              <Icon name="chevron-left" size={24} />
            </Link>
          )}
          <h1 className={styles.headerTitle}>{detail.name}</h1>
          {panel?.headerEnd}
          <TopNavigationMenu label="매물 정보 메뉴 열기">
            <button
              type="button"
              data-tone="danger"
              disabled={removeProperty.isPending}
              onClick={() => {
                void removeProperty
                  .mutateAsync()
                  .then(afterDelete)
                  .catch(() => undefined);
              }}
            >
              <Icon name="trash" size={16} />
              삭제
            </button>
          </TopNavigationMenu>
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
              onManagePhotos={managePhotos}
              onOpen={() => {
                photoTriggerRef.current = null;
                setSelectedPhotoIndex(0);
              }}
            />
            <div className={styles.infoPanel}>
              <PropertyBasicInfoSection
                property={detail}
                {...inlineEdit}
                onEditLocation={editLocation}
                afterAddress={
                  detail.location.latitude !== null && detail.location.longitude !== null ? (
                    <PropertyNearbyPreview
                      propertyId={propertyId}
                      latitude={detail.location.latitude}
                      longitude={detail.location.longitude}
                      isEditingLocation={isEditingLocation}
                      onSaveLocation={saveLocation}
                      onEndEditLocation={() => setIsEditingLocation(false)}
                    />
                  ) : undefined
                }
              />

              <PropertyAdditionalInfoSection property={detail} {...inlineEdit} />

              <PropertyMemoSection propertyId={propertyId} />

              <PropertyPhotoSection
                propertyId={propertyId}
                propertyName={detail.name}
                photoPreview={detail.photoPreview}
                onManage={managePhotos}
                onSelect={(index, trigger) => {
                  photoTriggerRef.current = trigger;
                  setSelectedPhotoIndex(index);
                }}
              />
            </div>
          </section>
        ) : (
          <section
            id="property-checklist-panel"
            className={styles.checklistPanel}
            role="tabpanel"
            aria-labelledby="property-checklist-tab"
          >
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
      </div>
      <PreviewNotSavedToast />
    </Root>
  );
};

const styles = {
  page: css`
    label: PropertyDetailPage-page;
    min-height: 100dvh;
    background: var(--color-canvas);

    /* 패널로 열면 패널 높이 안에서 스크롤하므로 화면 높이를 채우지 않는다. */
    &[data-panel='true'] {
      min-height: 0;
    }
  `,

  container: css`
    label: PropertyDetailPage-container;
    --page-inline-padding: 1rem;
    padding: 0 var(--page-inline-padding) 1.5rem;
  `,

  header: css`
    label: PropertyDetailPage-header;
    position: relative;
    display: flex;
    min-height: 3.5rem;
    align-items: center;
    gap: 0.5rem;

    & > details > summary {
      width: 2.5rem;
      height: 2.5rem;
    }
  `,

  backButton: css`
    label: PropertyDetailPage-backButton;
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-radius: 50%;
    padding: 0;
    background: transparent;
    color: var(--color-ink);
    text-decoration: none;
    cursor: pointer;
  `,

  /* 헤더 제목은 뒤로가기 화살표 바로 오른쪽에 왼쪽 정렬로 둔다. */
  headerTitle: css`
    label: PropertyDetailPage-headerTitle;
    min-width: 0;
    flex: 1;
    margin: 0;
    overflow: hidden;
    color: var(--color-ink);
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  tabs: css`
    label: PropertyDetailPage-tabs;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 0 -1rem;
    padding: 0 1rem;
    background: var(--color-surface);

    & button {
      min-height: 3rem;
      border: 0;
      background: transparent;
      color: #a2a4a9;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    /* 선택한 탭은 글자를 더 진하게 하는 대신 우리 파랑으로 알린다. */
    & button[aria-selected='true'] {
      color: var(--color-brand-blue-ink);
    }
  `,

  /* 체크리스트 탭은 화면 폭 전체를 회색으로 깔고, 그 위에 흰 카드(진행 링, 머리, 카테고리)를 올린다. */
  checklistPanel: css`
    label: PropertyDetailPage-checklistPanel;
    margin: 0 calc(var(--page-inline-padding) * -1) -1.5rem;
    padding: 0.5rem 0 2rem;
    background: var(--color-card-surface);
    min-height: 60dvh;

    /* 안쪽 섹션(DetailSection)이 흰 바탕과 위 구분선으로 회색을 가리지 않게 걷는다. */
    & > section {
      margin: 0;
      padding: 0;
      border-top: 0;
      background: transparent;
    }

    /* 섹션 제목(체크리스트)은 화면에서 숨긴다. 아래 첫 카드가 사용자 체크리스트 제목으로 시작해 겹치기 때문이다.
       화면 낭독기는 그대로 읽도록 지우지 않고 시각적으로만 숨긴다. */
    & > section > div:first-of-type {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
  `,

  infoPanel: css`
    label: PropertyDetailPage-infoPanel;
    position: relative;
    z-index: 1;
    margin: -2rem -1rem 0;
    padding: 1rem 1rem 1.5rem;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--color-surface);

    & > section[aria-label='매물 기본 정보'],
    & > section[aria-label='매물 부가 정보'] {
      margin-bottom: 0.5rem;
    }
  `,

  deleteError: css`
    label: PropertyDetailPage-deleteError;
    margin: 0.75rem 0 0;
    color: var(--color-error);
    font-size: 0.78rem;
    line-height: 1.5;
  `,
};

export default PropertyDetailPage;
