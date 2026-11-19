import { css } from '@emotion/css';

import RecordCardMenu from '@/pages/design-records/ui/record-list/RecordCardMenu';
import PropertyCard from '@/features/property/ui/property-card/PropertyCard';
import { NEIGHBORHOODS_PATH } from '@/shared/lib/navigation/appPaths';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import type usePropertyRoute from '../../hooks/usePropertyRoute';
import type { MyPropertyRow } from '../../model/myProperty';
import { propertyCommuteLabel } from '../../model/propertyCommute';
import RouteGuide from '../route-guide/RouteGuide';

type Props = {
  property: MyPropertyRow;
  destination: NeighborhoodPreviewContext['destination'];
  route: ReturnType<typeof usePropertyRoute>;
  commuteMaxMinutes: number;
  /** 주면 요약을 눌러도 화면을 옮기지 않고 이 함수를 부른다(데스크탑은 같은 옆 칸을 상세로 바꾼다). 없으면 상세 화면으로 이동한다. */
  onOpenDetail?: () => void;
  /** 카드 메뉴로 매물을 지운 뒤. */
  onDeleted: () => void;
  layout?: 'split' | 'stack';
};

/**
 * 동네 찾기 결과 지도에서 누른 내 매물. 위에는 내 기록 리스트와 같은 매물 카드(요약), 아래에는 출퇴근 장소와 그 집에서 출퇴근 장소까지의 노선을 둔다.
 * 위는 고정이고 아래만 길면 스크롤한다. `split`은 위 1, 아래 3 비율(데스크탑 옆 칸), `stack`은 휴대폰 시트처럼 위아래로 쌓는다.
 * 예시 매물은 서버에 없어 노선을 부르지 않고 안내만 보인다.
 */
const FinderPropertyPanel = ({
  property,
  destination,
  route,
  commuteMaxMinutes,
  onOpenDetail,
  onDeleted,
  layout = 'stack',
}: Props) => {
  const { commute, isPreview } = property;
  return (
    <div className={styles.root} data-layout={layout}>
      <section className={styles.summary} aria-label="매물 요약">
        <PropertyCard
          property={property.summary}
          returnTo={NEIGHBORHOODS_PATH}
          onOpen={onOpenDetail}
          actions={<RecordCardMenu propertyId={property.propertyId} propertyName={property.name} onDone={onDeleted} />}
        />
      </section>
      <section className={styles.body} aria-label="동네 찾기 상세">
        <h3 className={styles.heading}>출퇴근 장소</h3>
        <p className={styles.destination}>
          <strong>{destination.name}</strong>
          {destination.address !== '' && destination.address !== destination.name && (
            <small>{destination.address}</small>
          )}
        </p>
        {isPreview ? (
          <p className={styles.notice}>예시 매물이라 통근 시간을 계산하지 않아요</p>
        ) : commute === null ? (
          <p className={styles.notice}>통근 시간을 불러오고 있어요</p>
        ) : commute.status === 'REACHABLE' ? (
          <>
            <h3 className={styles.heading}>이 집에서 통근 {propertyCommuteLabel(commute, commuteMaxMinutes)}</h3>
            <RouteGuide route={route.route} isLoading={route.isLoading} error={route.error} onRetry={route.retry} />
          </>
        ) : (
          <p className={styles.notice}>
            {commute.status === 'NO_LOCATION'
              ? '매물 위치가 없어 통근 시간을 계산하지 못했어요'
              : `${commuteMaxMinutes}분 안에 닿는 노선이 없어요`}
          </p>
        )}
      </section>
    </div>
  );
};

const styles = {
  root: css`
    label: FinderPropertyPanel-root;
    display: grid;
    min-height: 0;
    gap: 0.5rem;

    /* 옆 칸: 위 요약 1, 아래 노선 3. 아래만 스크롤한다. */
    &[data-layout='split'] {
      height: 100%;
      grid-template-rows: minmax(0, 1fr) minmax(0, 3fr);
      gap: 0;
    }
  `,

  summary: css`
    label: FinderPropertyPanel-summary;
    min-height: 0;
    overflow: hidden;

    [data-layout='split'] > & {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--color-border);
    }
  `,

  body: css`
    label: FinderPropertyPanel-body;
    display: grid;
    align-content: start;
    min-height: 0;
    gap: 0.5rem;
    padding: 0.5rem 0 1rem;

    [data-layout='split'] > & {
      overflow-y: auto;
      padding: 0.75rem 1rem 1rem;
    }
  `,

  heading: css`
    label: FinderPropertyPanel-heading;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.78rem;
    font-weight: 700;
  `,

  destination: css`
    label: FinderPropertyPanel-destination;
    display: grid;
    margin: 0;
    gap: 0.1rem;

    & strong {
      font-size: 0.95rem;
    }

    & small {
      color: var(--color-ink-soft);
      font-size: 0.78rem;
    }
  `,

  notice: css`
    label: FinderPropertyPanel-notice;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.85rem;
  `,
};

export default FinderPropertyPanel;
