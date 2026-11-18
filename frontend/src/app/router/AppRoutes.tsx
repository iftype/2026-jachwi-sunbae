import type { ReactNode } from 'react';
import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';

import PropertyAppLayout from '@/app/layouts/property-app-layout/PropertyAppLayout';
import PublicExploreLayout from '@/app/layouts/public-explore-layout/PublicExploreLayout';
import RecordsPageSkeleton from '@/pages/design-records/RecordsPageSkeleton';
import NeighborhoodPageSkeleton from '@/pages/neighborhood-preview/NeighborhoodPageSkeleton';
import {
  ABOUT_PATH,
  ADDRESS_SEARCH_PATH,
  ADMIN_PATH,
  CHECKLIST_CREATE_PATH,
  CHECKLISTS_PATH,
  COMPARE_PATH,
  EXPLORE_NEARBY_PATH,
  EXPLORE_PATH,
  EXPORT_PATH,
  GUIDE_PATH,
  HOME_PATH,
  LANDING_PATH,
  LOGIN_PATH,
  MAP_SELECT_LOCATION_PATH,
  MY_ALIAS_PATH,
  MY_PATH,
  type NeighborhoodBasePath,
  NEIGHBORHOODS_NEARBY_PATH,
  NEIGHBORHOODS_PATH,
  OAUTH_COMPLETE_PATH,
  PRIVACY_PATH,
  PROPERTIES_PATH,
  PROPERTY_NEW_PATH,
  propertyDetailPath,
  RECORDS_MAP_PATH,
  RECORDS_PATH,
  ROUTE_PATTERNS,
  TIPS_PATH,
} from '@/shared/lib/navigation/appPaths';

import LazyRouteBoundary from './LazyRouteBoundary';
import ProtectedRoute from './ProtectedRoute';

const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));
const AddressSearchPage = lazy(() => import('@/pages/address-search/AddressSearchPage'));
const CheapMealsPage = lazy(() => import('@/pages/cheap-meals/CheapMealsPage'));
const UnifiedMapPage = lazy(() => import('@/pages/unified-map/UnifiedMapPage'));
const NeighborhoodPreviewPage = lazy(() => import('@/pages/neighborhood-preview/NeighborhoodPreviewPage'));
const NeighborhoodRoutePage = lazy(() => import('@/pages/neighborhood-preview/NeighborhoodRoutePage'));
const UsageGuidePage = lazy(() => import('@/pages/usage-guide/UsageGuidePage'));
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));
const PrivacyPage = lazy(() => import('@/pages/privacy/PrivacyPage'));
const OAuthCompletePage = lazy(() => import('@/pages/oauth-complete/OAuthCompletePage'));
const NotFoundPage = lazy(() => import('@/pages/not-found/NotFoundPage'));
const PropertyDetailPage = lazy(() => import('@/pages/property-detail/PropertyDetailPage'));
const EditPropertyPage = lazy(() => import('@/pages/edit-property/EditPropertyPage'));
const PropertyPhotosPage = lazy(() => import('@/pages/property-photos/PropertyPhotosPage'));
const PropertyMemoPage = lazy(() => import('@/pages/property-memo/PropertyMemoPage'));
const ChecklistDetailPage = lazy(() => import('@/pages/checklist-detail/ChecklistDetailPage'));
const CreateChecklistPage = lazy(() => import('@/pages/create-checklist/CreateChecklistPage'));
const ChecklistListPage = lazy(() => import('@/pages/checklist-list/ChecklistListPage'));
const PropertyActiveChecklistPage = lazy(() => import('@/pages/property-active-checklist/PropertyActiveChecklistPage'));
const PropertyChecklistPage = lazy(() => import('@/pages/property-checklist/PropertyChecklistPage'));
const MapLocationSelectPage = lazy(() => import('@/pages/map-location-select/MapLocationSelectPage'));
const NearbyAnalysisPage = lazy(() => import('@/pages/nearby-analysis/NearbyAnalysisPage'));
const PropertyComparePage = lazy(() => import('@/pages/property-compare/PropertyComparePage'));
const UpcomingFeaturePage = lazy(() => import('@/pages/upcoming-feature/UpcomingFeaturePage'));

const lazyPage = (page: ReactNode, fallback?: ReactNode) => (
  <LazyRouteBoundary fallback={fallback}>{page}</LazyRouteBoundary>
);

/** 예전 목록 주소(`/properties`)는 홈으로 보낸다. `?view=` 같은 쿼리는 그대로 잇는다. */
const LegacyRecordsRoute = () => <Navigate to={{ pathname: RECORDS_PATH, search: useLocation().search }} replace />;

/** 인프라 지도는 본 방 기록 지도로 합쳤다. 예전 주소(`/map`, `/map/:propertyId`)로 들어오면 기록 화면으로 보낸다. */
const LegacyMapRoute = () => {
  const propertyId = useParams().propertyId;
  return <Navigate to={propertyId === undefined ? RECORDS_PATH : propertyDetailPath(propertyId)} replace />;
};

/**
 * 동네 찾기는 통근과 월세를 한 지도에서 함께 본다. 기준을 고르던 예전 주소(`/explore/commute`, `/explore/price`,
 * `/neighborhoods/map?mode=`)로 들어오면 새 주소로 보낸다. 통근 동네 상세는 그대로 잇고, 법정동 월세 상세는 지도로 보낸다.
 */
const LegacyNeighborhoodRoute = ({ base }: { base: NeighborhoodBasePath }) => {
  const rest = useParams()['*'] ?? '';
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.delete('mode');
  const query = params.toString();
  return (
    <Navigate
      to={{ pathname: rest.startsWith('areas/') ? `${base}/${rest}` : base, search: query ? `?${query}` : '' }}
      replace
    />
  );
};
const AppRoutes = () => (
  <Routes>
    <Route path={`${ADMIN_PATH}/*`} element={lazyPage(<AdminPage />)} />
    <Route element={<PublicExploreLayout />}>
      <Route path={EXPLORE_PATH} element={lazyPage(<NeighborhoodPreviewPage />, <NeighborhoodPageSkeleton />)}>
        <Route path={ROUTE_PATTERNS.area} element={lazyPage(<NeighborhoodRoutePage />)} />
        <Route path={ROUTE_PATTERNS.areaDetails} element={lazyPage(<NeighborhoodRoutePage />)} />
      </Route>
      <Route path={ROUTE_PATTERNS.legacyExploreCommute} element={<LegacyNeighborhoodRoute base={EXPLORE_PATH} />} />
      <Route path={ROUTE_PATTERNS.legacyExplorePrice} element={<LegacyNeighborhoodRoute base={EXPLORE_PATH} />} />
      <Route path={EXPLORE_NEARBY_PATH} element={lazyPage(<NearbyAnalysisPage />)} />
    </Route>
    <Route element={<PropertyAppLayout />}>
      <Route path={GUIDE_PATH} element={lazyPage(<UsageGuidePage />)} />
      <Route
        path={ROUTE_PATTERNS.legacyNeighborhoodsMap}
        element={<LegacyNeighborhoodRoute base={NEIGHBORHOODS_PATH} />}
      />
      <Route path={NEIGHBORHOODS_NEARBY_PATH} element={lazyPage(<NearbyAnalysisPage />)} />
    </Route>
    {/* 생활권 탐색 광고 랜딩. 회원이 아니어도 보고, 웹으로 시작하면 홈으로 잇는다. */}
    <Route path={LANDING_PATH} element={lazyPage(<LandingPage />)} />
    <Route path={ABOUT_PATH} element={<Navigate to={GUIDE_PATH} replace />} />
    <Route path={PRIVACY_PATH} element={lazyPage(<PrivacyPage />)} />
    {/* OAuth 콜백 뒤 돌아오는 곳. 새 쿠키로 다시 로그인해 결과를 정하고 마이로 보낸다. */}
    <Route path={OAUTH_COMPLETE_PATH} element={lazyPage(<OAuthCompletePage />)} />
    {/* 로그인 화면은 없다. 예전 주소로 들어오면 홈에서 자동 로그인한다. */}
    <Route path={LOGIN_PATH} element={<Navigate to={HOME_PATH} replace />} />
    {/* 매물은 본 방 기록 지도에서 바로 등록한다. 예전 매물 등록 주소로 들어오면 기록 지도로 보낸다. */}
    <Route path={PROPERTY_NEW_PATH} element={<Navigate to={RECORDS_MAP_PATH} replace />} />
    {/* 첫 주소(`/`)를 포함한 회원 화면. 자동 로그인(복원 또는 익명 회원 생성)을 기다리는 동안에도 화면 뼈대를 바로 그린다. */}
    <Route element={<ProtectedRoute />}>
      {/* 탭마다 주소가 따로 있다. 탭 없는 주소와 예전 `?tab=` 주소는 화면이 탭 주소로 바꾼다. */}
      <Route path={ROUTE_PATTERNS.cheapMeals} element={lazyPage(<CheapMealsPage />)} />
      <Route path={PROPERTIES_PATH} element={<LegacyRecordsRoute />} />
      <Route path={MY_ALIAS_PATH} element={<Navigate to={MY_PATH} replace />} />
      <Route element={lazyPage(<UnifiedMapPage />, <RecordsPageSkeleton />)}>
        {/* 홈이 곧 본 방 기록(지도와 리스트)이다. 화면은 이 셸이 그린다. */}
        <Route path={HOME_PATH} />
        <Route path={MY_PATH} />
        <Route path={ROUTE_PATTERNS.propertyRecords}>
          <Route index element={lazyPage(<PropertyDetailPage />)} />
          <Route
            path={ROUTE_PATTERNS.propertyActiveChecklistChild}
            element={lazyPage(<PropertyActiveChecklistPage />)}
          />
        </Route>
        <Route path={NEIGHBORHOODS_PATH}>
          <Route path={ROUTE_PATTERNS.area} element={lazyPage(<NeighborhoodRoutePage />)} />
          <Route path={ROUTE_PATTERNS.areaDetails} element={lazyPage(<NeighborhoodRoutePage />)} />
        </Route>
      </Route>
      <Route element={<PropertyAppLayout />}>
        <Route path={ROUTE_PATTERNS.propertyEdit} element={lazyPage(<EditPropertyPage />)} />
        <Route path={ROUTE_PATTERNS.propertyPhotos} element={lazyPage(<PropertyPhotosPage />)} />
        <Route path={ROUTE_PATTERNS.propertyMemo} element={lazyPage(<PropertyMemoPage />)} />
        <Route path={ROUTE_PATTERNS.propertyNearby} element={lazyPage(<NearbyAnalysisPage />)} />
        <Route path={ROUTE_PATTERNS.propertyChecklist} element={lazyPage(<PropertyChecklistPage />)} />
        <Route path={CHECKLISTS_PATH} element={lazyPage(<ChecklistListPage />)}>
          <Route path={CHECKLIST_CREATE_PATH} element={lazyPage(<CreateChecklistPage />)} />
          <Route path={ROUTE_PATTERNS.checklistDetail} element={lazyPage(<ChecklistDetailPage />)} />
        </Route>
        {/* 이전 단계별 주소는 관리 화면으로 보낸다. */}
        <Route path={ROUTE_PATTERNS.legacyChecklists} element={<Navigate to={CHECKLISTS_PATH} replace />} />
        <Route path={ROUTE_PATTERNS.legacyMap} element={<LegacyMapRoute />} />
        <Route path={MAP_SELECT_LOCATION_PATH} element={lazyPage(<MapLocationSelectPage />)} />
        <Route path={ADDRESS_SEARCH_PATH} element={lazyPage(<AddressSearchPage />)} />
        <Route path={COMPARE_PATH} element={lazyPage(<PropertyComparePage />)} />
        <Route path={EXPORT_PATH} element={lazyPage(<UpcomingFeaturePage feature="export" />)} />
        <Route path={TIPS_PATH} element={lazyPage(<UpcomingFeaturePage feature="tips" />)} />
      </Route>
    </Route>
    <Route path={ROUTE_PATTERNS.notFound} element={lazyPage(<NotFoundPage />)} />
  </Routes>
);

export default AppRoutes;
