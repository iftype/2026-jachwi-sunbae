import { useParams } from 'react-router-dom';

import PropertyDetailPage from '@/pages/property-detail/PropertyDetailPage';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import MapDesktopPage from './desktop/MapDesktopPage';
import MapMobilePage from './mobile/MapMobilePage';

/**
 * 인프라 지도(`/map`, `/map/:propertyId`). 데스크탑·휴대폰 화면을 여기서 한 번만 고르고, 상태·조각은 두 화면이 함께 쓴다.
 * 매물 주소는 데스크탑이면 지도 왼쪽 칸에 상세를 열고, 휴대폰이면 지도로 돌아가는 상세 화면을 연다.
 */
const MapPage = () => {
  const isDesktop = useIsDesktop();
  const propertyId = useParams().propertyId;
  if (isDesktop) return <MapDesktopPage />;
  return propertyId === undefined ? <MapMobilePage /> : <PropertyDetailPage returnTo="/map" />;
};

export default MapPage;
