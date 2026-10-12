import type { ReactNode } from 'react';
import { lazy } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import PropertyAppLayout from '@/app/layouts/property-app-layout/PropertyAppLayout';
import LoginPage from '@/pages/login/LoginPage';
import { useAuthentication } from '@/features/auth/model/useAuthentication';
import { isChecklistStage } from '@/features/checklist/model/checklist';

import LazyRouteBoundary from './LazyRouteBoundary';
import ProtectedRoute from './ProtectedRoute';

const IntroPage = lazy(() => import('@/pages/intro/IntroPage'));
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));
const PrivacyPage = lazy(() => import('@/pages/privacy/PrivacyPage'));
const NotFoundPage = lazy(() => import('@/pages/not-found/NotFoundPage'));
const PropertyListPage = lazy(() => import('@/pages/property-list/PropertyListPage'));
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

const LoginRoute = () => {
  const { session } = useAuthentication();

  if (session !== null) {
    return <Navigate to="/properties" replace />;
  }

  return <LoginPage />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/intro" element={lazyPage(<IntroPage />)} />
    <Route path="/landing" element={lazyPage(<LandingPage />)} />
    <Route path="/privacy" element={lazyPage(<PrivacyPage />)} />
    <Route path="/login" element={<LoginRoute />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<PropertyAppLayout />}>
        <Route index element={<Navigate to="/properties" replace />} />
        <Route path="/properties" element={lazyPage(<PropertyListPage />)} />
        <Route path="/properties/new" element={lazyPage(<CreatePropertyPage />)} />
        <Route path="/properties/:propertyId" element={lazyPage(<PropertyDetailPage />)} />

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
        <Route path="/map" element={lazyPage(<MapPage />)} />
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
