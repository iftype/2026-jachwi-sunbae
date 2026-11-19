import { css } from '@emotion/css';

import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import { formatRentPair } from '../../model/criteriaLabels';
import ListingLink from '../listing-link/ListingLink';
import RouteGuide from '../route-guide/RouteGuide';

type Props = {
  preview: NeighborhoodPreviewContext;
  area: NonNullable<NeighborhoodPreviewContext['selected']>;
};

/** 대중교통 상세 본문(월세 시세·경로·안내·매물 열기). 데스크탑·휴대폰 상세가 함께 쓴다. */
const RouteDetailBody = ({ preview, area }: Props) => (
  <>
    <div className={styles.top}>
      <section className={styles.rent} aria-label="월세 시세">
        <span>월세 시세</span>
        {area.rent ? <strong>{formatRentPair(area.rent)}</strong> : <strong>거래가 적어 시세를 내지 않았어요</strong>}
      </section>
      <ListingLink areaName={area.name} center={area.center} onOpen={preview.openListing} />
    </div>
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
      {preview.isPublicExplore && (
        <ExplorationRecordAction
          location={{ ...area.center, address: area.fullName, roadAddress: null, jibunAddress: area.fullName }}
        />
      )}
    </div>
  </>
);

const styles = {
  rent: css`
    label: RouteDetailBody-rent;
    display: grid;
    flex: 1;
    min-width: 0;
    gap: 0.25rem;
    padding: 0.9rem 1rem;
    border-radius: 0.75rem;
    background: var(--color-surface-muted);

    & > span,
    & > small {
      color: var(--color-muted);
      font-size: 0.8rem;
    }

    & > strong {
      font-size: 1rem;
    }
  `,

  top: css`
    label: RouteDetailBody-top;
    display: flex;
    align-items: stretch;
    gap: 0.6rem;
    margin-bottom: 1rem;
  `,

  notice: css`
    label: RouteDetailBody-notice;
    color: var(--color-muted);
    line-height: 1.6;
    font-size: 0.8rem;
    margin-top: 1.5rem;
  `,

  actions: css`
    label: RouteDetailBody-actions;
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
  `,
};

export default RouteDetailBody;
