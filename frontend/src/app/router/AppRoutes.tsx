import type { ReactNode } from 'react';
import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';

import PropertyAppLayout from '@/app/layouts/property-app-layout/PropertyAppLayout';
import PublicExploreLayout from '@/app/layouts/public-explore-layout/PublicExploreLayout';
import { isChecklistStage } from '@/features/checklist/model/checklist';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import LazyRouteBoundary from './LazyRouteBoundary';
import ProtectedRoute from './ProtectedRoute';

const DesignHomePage = lazy(() => import('@/pages/design-home/DesignHomePage'));
const DesignRecordsPage = lazy(() => import('@/pages/design-records/DesignRecordsPage'));
const NeighborhoodPreviewPage = lazy(() => import('@/pages/neighborhood-preview/NeighborhoodPreviewPage'));
const NeighborhoodEntryPage = lazy(() => import('@/pages/neighborhood-entry/NeighborhoodEntryPage'));
const NeighborhoodRoutePage = lazy(() => import('@/pages/neighborhood-preview/NeighborhoodRoutePage'));
const NeighborhoodPricePage = lazy(() => import('@/pages/neighborhood-preview/NeighborhoodPricePage'));
const UsageGuidePage = lazy(() => import('@/pages/usage-guide/UsageGuidePage'));
const PrivacyPage = lazy(() => import('@/pages/privacy/PrivacyPage'));
const NotFoundPage = lazy(() => import('@/pages/not-found/NotFoundPage'));
const CreatePropertyPage = lazy(() => import('@/pages/create-property/CreatePropertyPage'));
const PropertyDetailPage = lazy(() => import('@/pages/property-detail/PropertyDetailPage'));
const EditPropertyPage = lazy(() => import('@/pages/edit-property/EditPropertyPage'));
const PropertyPhotosPage = lazy(() => import('@/pages/property-photos/PropertyPhotosPage'));
const PropertyMemoPage = lazy(() => import('@/pages/property-memo/PropertyMemoPage'));
const ChecklistListPage = lazy(() => import('@/pages/checklist-list/ChecklistListPage'));
const CreateChecklistPage = lazy(() => import('@/pages/create-checklist/CreateChecklistPage'));
const ChecklistDetailPage = lazy(() => import('@/pages/checklist-detail/ChecklistDetailPage'));
const PropertyActiveChecklistPage = lazy(() => import('@/pages/property-active-checklist/PropertyActiveChecklistPage'));
const PropertyChecklistPage = lazy(() => import('@/pages/property-checklist/PropertyChecklistPage'));
const MyPage = lazy(() => import('@/pages/my/MyPage'));
const MapPage = lazy(() => import('@/pages/map/MapPage'));
const MapLocationSelectPage = lazy(() => import('@/pages/map-location-select/MapLocationSelectPage'));
const NearbyAnalysisPage = lazy(() => import('@/pages/nearby-analysis/NearbyAnalysisPage'));
const PropertyComparePage = lazy(() => import('@/pages/property-compare/PropertyComparePage'));
const UpcomingFeaturePage = lazy(() => import('@/pages/upcoming-feature/UpcomingFeaturePage'));

const lazyPage = (page: ReactNode) => <LazyRouteBoundary>{page}</LazyRouteBoundary>;

/** 예전 단계별 목록 주소(/checklists/ON_SITE 등)로 들어와도 단일 목록으로 보낸다. */
const ChecklistResourceRoute = () => {
  const resource = useParams().resource;
  if (isChecklistStage(resource)) {
    return <Navigate to="/checklists" replace />;
  }
  return <ChecklistDetailPage />;
};

/**
 * 본 방 기록(`/properties`)과 매물 상세(`/properties/:propertyId`).
 * 데스크탑은 두 주소 모두 기록 화면이 그리고 상세를 왼쪽 칸에 연다. 휴대폰 상세는 앱 레이아웃 안 상세 화면이다.
 */
const RecordsRoute = () => {
  const isDesktop = useIsDesktop();
  const propertyId = useParams().propertyId;
  if (isDesktop || propertyId === undefined) return lazyPage(<DesignRecordsPage />);
  return <PropertyAppLayout />;
};

/** 광고에 쓰던 랜딩 주소는 홈으로 바로 보낸다. 유입 측정을 위해 쿼리(utm 등)는 그대로 넘긴다. */
const LegacyLandingRoute = () => {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/', search }} replace />;
};
const AppRoutes = () => (
  <Routes>
    <Route element={<PublicExploreLayout />}>
      <Route path="/explore" element={lazyPage(<NeighborhoodEntryPage />)} />
      <Route path="/explore/commute" element={lazyPage(<NeighborhoodPreviewPage />)}>
        <Route path="areas/:adminDongCode" element={lazyPage(<NeighborhoodRoutePage />)} />
        <Route path="areas/:adminDongCode/details" element={lazyPage(<NeighborhoodRoutePage />)} />
      </Route>
      <Route path="/explore/price" element={lazyPage(<NeighborhoodPreviewPage />)}>
        <Route path="prices/:legalDongCode" element={lazyPage(<NeighborhoodPricePage />)} />
      </Route>
      <Route path="/explore/nearby" element={lazyPage(<NearbyAnalysisPage />)} />
    </Route>
    <Route element={<PropertyAppLayout />}>
      <Route path="/guide" element={lazyPage(<UsageGuidePage />)} />
      <Route path="/neighborhoods" element={lazyPage(<NeighborhoodEntryPage />)} />
      <Route path="/neighborhoods/map" element={lazyPage(<NeighborhoodPreviewPage />)}>
        <Route path="areas/:adminDongCode" element={lazyPage(<NeighborhoodRoutePage />)} />
        <Route path="areas/:adminDongCode/details" element={lazyPage(<NeighborhoodRoutePage />)} />
        <Route path="prices/:legalDongCode" element={lazyPage(<NeighborhoodPricePage />)} />
      </Route>
      <Route path="/neighborhoods/nearby" element={lazyPage(<NearbyAnalysisPage />)} />
    </Route>
    {/* 랜딩은 없다. 첫 진입은 홈에서 자동 로그인하고, 서비스 소개는 사용 방법(`/guide`)이 맡는다. */}
    <Route path="/landing" element={<LegacyLandingRoute />} />
    <Route path="/about" element={<Navigate to="/guide" replace />} />
    <Route path="/privacy" element={lazyPage(<PrivacyPage />)} />
    {/* 로그인 화면은 없다. 예전 주소로 들어오면 홈에서 자동 로그인한다. */}
    <Route path="/login" element={<Navigate to="/" replace />} />
    {/* 첫 주소(`/`)를 포함한 회원 화면은 자동 로그인(복원 또는 익명 회원 생성)을 마친 뒤 그린다. */}
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={lazyPage(<DesignHomePage />)} />
      <Route path="/properties/:propertyId?" element={<RecordsRoute />}>
        <Route index element={lazyPage(<PropertyDetailPage />)} />
      </Route>
      <Route element={<PropertyAppLayout />}>
        <Route path="/properties/new" element={lazyPage(<CreatePropertyPage />)} />
        <Route path="/properties/:propertyId/edit" element={lazyPage(<EditPropertyPage />)} />
        <Route path="/properties/:propertyId/photos" element={lazyPage(<PropertyPhotosPage />)} />
        <Route path="/properties/:propertyId/memo" element={lazyPage(<PropertyMemoPage />)} />
        <Route path="/properties/:propertyId/nearby" element={lazyPage(<NearbyAnalysisPage />)} />
        <Route
          path="/properties/:propertyId/active-checklists/:stage"
          element={lazyPage(<PropertyActiveChecklistPage />)}
        />
        <Route
          path="/properties/:propertyId/checklists/:propertyChecklistId"
          element={lazyPage(<PropertyChecklistPage />)}
        />
        <Route path="/checklists" element={lazyPage(<ChecklistListPage />)} />
        <Route path="/checklists/new" element={lazyPage(<CreateChecklistPage />)} />
        <Route path="/checklists/:resource" element={lazyPage(<ChecklistResourceRoute />)} />
        <Route path="/me" element={lazyPage(<MyPage />)} />
        <Route path="/map/:propertyId?" element={lazyPage(<MapPage />)} />
        <Route path="/map/select-location" element={lazyPage(<MapLocationSelectPage />)} />
        <Route path="/compare" element={lazyPage(<PropertyComparePage />)} />
        <Route path="/export" element={lazyPage(<UpcomingFeaturePage feature="export" />)} />
        <Route path="/tips" element={lazyPage(<UpcomingFeaturePage feature="tips" />)} />
      </Route>
    </Route>
    <Route path="*" element={lazyPage(<NotFoundPage />)} />
  </Routes>
);

export default AppRoutes;
