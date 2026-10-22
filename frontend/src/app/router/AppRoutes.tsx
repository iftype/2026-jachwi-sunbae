import type { ReactNode } from 'react';
import { lazy } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import PropertyAppLayout from '@/app/layouts/property-app-layout/PropertyAppLayout';
import PublicExploreLayout from '@/app/layouts/public-explore-layout/PublicExploreLayout';
import LoginPage from '@/pages/login/LoginPage';
import { useAuthentication } from '@/features/auth/model/useAuthentication';
import { isChecklistStage } from '@/features/checklist/model/checklist';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import LazyRouteBoundary from './LazyRouteBoundary';
import ProtectedRoute from './ProtectedRoute';

const ServiceIntroductionPage = lazy(() => import('@/pages/landing/LandingPage'));
const DesignHomePage = lazy(() => import('@/pages/design-home/DesignHomePage'));
const DesignRecordsPage = lazy(() => import('@/pages/design-records/DesignRecordsPage'));
const NeighborhoodPreviewPage = lazy(() => import('@/pages/neighborhood-preview/NeighborhoodPreviewPage'));
const NeighborhoodEntryPage = lazy(() => import('@/pages/neighborhood-entry/NeighborhoodEntryPage'));
const NeighborhoodRoutePage = lazy(() => import('@/pages/neighborhood-preview/NeighborhoodRoutePage'));
const NeighborhoodPricePage = lazy(() => import('@/pages/neighborhood-preview/NeighborhoodPricePage'));
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

const LoginRoute = () => {
  const { session } = useAuthentication();

  return session !== null ? <Navigate to="/" replace /> : <LoginPage />;
};

const LandingRoute = () => {
  const { session } = useAuthentication();
  return session ? <Navigate to="/" replace /> : lazyPage(<ServiceIntroductionPage />);
};
/**
 * 첫 주소(`/`)는 로그인했으면 홈을, 아니면 랜딩을 보여준다. 로그인은 `/login`에서 따로 한다.
 * 토큰 만료 등으로 방금 로그아웃됐다면 까닭을 안내하는 로그인 화면으로 보낸다.
 */
const HomeRoute = () => {
  const { session, terminationReason } = useAuthentication();
  if (session) return <ProtectedRoute />;
  return <Navigate to={terminationReason ? '/login' : '/landing'} replace />;
};
const AppRoutes = () => (
  <Routes>
    <Route element={<HomeRoute />}>
      <Route path="/" element={lazyPage(<DesignHomePage />)} />
    </Route>
    <Route element={<PublicExploreLayout />}>
      <Route path="/explore" element={lazyPage(<NeighborhoodEntryPage />)} />
      <Route path="/explore/commute" element={lazyPage(<NeighborhoodPreviewPage />)}>
        <Route path="areas/:adminDongCode" element={lazyPage(<NeighborhoodRoutePage />)} />
        <Route path="areas/:adminDongCode/details" element={lazyPage(<NeighborhoodRoutePage />)} />
      </Route>
      <Route path="/explore/price" element={lazyPage(<NeighborhoodPreviewPage />)}>
        <Route path="prices/:legalDongCode" element={lazyPage(<NeighborhoodPricePage />)} />
      </Route>
    </Route>
    <Route element={<PropertyAppLayout />}>
      <Route path="/neighborhoods" element={lazyPage(<NeighborhoodEntryPage />)} />
      <Route path="/neighborhoods/map" element={lazyPage(<NeighborhoodPreviewPage />)}>
        <Route path="areas/:adminDongCode" element={lazyPage(<NeighborhoodRoutePage />)} />
        <Route path="areas/:adminDongCode/details" element={lazyPage(<NeighborhoodRoutePage />)} />
        <Route path="prices/:legalDongCode" element={lazyPage(<NeighborhoodPricePage />)} />
      </Route>
    </Route>
    <Route path="/landing" element={<LandingRoute />} />
    <Route path="/about" element={lazyPage(<ServiceIntroductionPage />)} />
    <Route path="/privacy" element={lazyPage(<PrivacyPage />)} />
    <Route path="/login" element={<LoginRoute />} />
    <Route element={<ProtectedRoute />}>
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
