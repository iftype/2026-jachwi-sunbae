import { useMatch, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { formatManwon } from '@/features/map/api/commuteApi';
import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';

import useNeighborhoodDetailAnalytics from './hooks/useNeighborhoodDetailAnalytics';
import type { NeighborhoodPreviewContext } from './hooks/useNeighborhoodPreview';
import ListingLink from './ui/listing-link/ListingLink';
import RouteGuide from './ui/route-guide/RouteGuide';

import styles from './NeighborhoodRoutePage.module.css';

const NeighborhoodRoutePage = () => {
  const preview = useOutletContext<NeighborhoodPreviewContext>();
  const navigate = useNavigate();
  const { adminDongCode } = useParams();
  const isDesktop = useIsDesktop();
  const isDetailPage = useMatch(`${preview.mapPath}/areas/:adminDongCode/details`);
  const area = preview.selected?.adminDongCode === adminDongCode ? preview.selected : undefined;
  useNeighborhoodDetailAnalytics({
    mock: preview.isMockData,
    ready: !!isDetailPage && !!area && !!preview.route && !preview.isRouteLoading && !preview.routeError,
    failed: !!isDetailPage && !!area && !!preview.routeError,
    itemKey: area && preview.selectedStation ? `${area.adminDongCode}:${preview.selectedStation.stopId}` : null,
    hasRent: !!area?.rent,
  });

  if (!area)
    return (
      <main className={styles.page}>
        <h1>동네를 먼저 선택해주세요</h1>
        <Button onClick={() => navigate(preview.mapPath, { replace: true })}>지도로 돌아가기</Button>
      </main>
    );

  if (!isDetailPage) return null;

  return (
    <main className={styles.detailPage} aria-label={`${area.name} 대중교통 상세`}>
      <header className={styles.header}>
        {!isDesktop && (
          <Button variant="text" aria-label="대중교통 상세 닫기" onClick={preview.closeAreaDetails}>
            <Icon name="close" size={24} />
          </Button>
        )}
        <h1>{area.name} 대중교통</h1>
      </header>
      <section className={styles.rent} aria-label="월세 시세">
        <span>월세 시세</span>
        {area.rent ? (
          <>
            <strong>
              월세 {formatManwon(area.rent.monthlyRentKrw)} · 보증금 {formatManwon(area.rent.depositKrw)}
            </strong>
            <small>
              {area.rent.legalDongNames.join('·')} 거래 {area.rent.transactionCount}건 중앙값
            </small>
            {preview.rentPeriod && (
              <small>
                {preview.rentPeriod.startDate} ~ {preview.rentPeriod.endDate} 계약
              </small>
            )}
          </>
        ) : (
          <strong>거래가 적어 시세를 내지 않았어요</strong>
        )}
      </section>
      <RouteGuide
        route={preview.route}
        isLoading={preview.isRouteLoading}
        error={preview.routeError}
        onRetry={preview.retryRoute}
      />
      <p className={styles.notice}>
        시간표 기반 예상 정보예요. 실시간 버스 도착 정보는 제공하지 않아요. 집에서 출발 정류장까지 도보는 별도입니다.
      </p>
      <div className={styles.actions}>
        <ListingLink areaName={area.name} center={area.center} onOpen={preview.openListing} />
        {preview.isPublicExplore && (
          <ExplorationRecordAction
            location={{ ...area.center, address: area.fullName, roadAddress: null, jibunAddress: area.fullName }}
          />
        )}
      </div>
    </main>
  );
};

export default NeighborhoodRoutePage;
