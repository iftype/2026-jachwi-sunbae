import { css } from '@emotion/css';

import RecordCardMenu from '@/pages/design-records/ui/record-list/RecordCardMenu';
import PropertyNearbyPreview from '@/pages/property-detail/ui/property-nearby-preview/PropertyNearbyPreview';
import PropertyCard from '@/features/property/ui/property-card/PropertyCard';
import { NEIGHBORHOODS_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';
import { useMapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';

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
  /** 출퇴근 장소가 정해진 결과 단계인지. 아니면 노선을 부르지 않고 안내만 보인다. 기본은 정해짐. */
  hasDestination?: boolean;
  /** 주면 요약을 눌러도 화면을 옮기지 않고 이 함수를 부른다(데스크탑은 같은 옆 칸을 상세로 바꾼다). 없으면 상세 화면으로 이동한다. */
  onOpenDetail?: () => void;
  /** 카드 메뉴로 매물을 지운 뒤. */
  onDeleted: () => void;
  layout?: 'split' | 'stack';
};

/**
 * 동네 찾기 결과 지도에서 누른 내 매물. 위에는 내 기록 리스트와 같은 매물 카드(요약), 아래에는 출퇴근 장소와 그 집에서 출퇴근 장소까지의 노선, 그 밑에 주변 인프라(500m 시설 요약)를 둔다.
 * 위는 카드 높이만큼만 차지하고 아래가 나머지를 쓰며 길면 스크롤한다. `split`은 데스크탑 옆 칸, `stack`은 휴대폰 시트처럼 위아래로 쌓는다.
 * 예시 매물은 서버에 없어 노선을 부르지 않고 안내만 보인다. 출퇴근 장소를 정하기 전(선택 전, 선택 중)에도 노선을 부르지 않고 안내만 보인다.
 */
const FinderPropertyPanel = ({
  property,
  destination,
  route,
  commuteMaxMinutes,
  hasDestination = true,
  onOpenDetail,
  onDeleted,
  layout = 'stack',
}: Props) => {
  const { commute, isPreview, latitude, longitude } = property;
  const mode = useMapModeSwitch();
  return (
    <div className={styles.root} data-layout={layout}>
      <section className={styles.summary} aria-label="매물 요약">
        {/* 통합 지도 안에서만 둔다. 내 기록 모드로 돌아가는 기존 전환 핸들러를 그대로 쓴다. */}
        {mode?.target === 'records' && (
          <div className={styles.head}>
            <button
              type="button"
              className={styles.listLink}
              aria-label="내 기록 전체 리스트 보기"
              onClick={() => mode.onSwitch()}
            >
              전체 리스트 보기
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        )}
        <PropertyCard
          property={property.summary}
          returnTo={NEIGHBORHOODS_PATH}
          onOpen={onOpenDetail}
          actions={<RecordCardMenu propertyId={property.propertyId} propertyName={property.name} onDone={onDeleted} />}
        />
      </section>
      <section className={styles.body} aria-label="동네 찾기 상세">
        {hasDestination && (
          <div className={styles.destination} role="group" aria-label="출퇴근 장소">
            <strong>{destination.name}</strong>
            {destination.address !== '' && destination.address !== destination.name && (
              <small>{destination.address}</small>
            )}
          </div>
        )}
        {isPreview ? (
          <p className={styles.notice}>예시 매물이라 통근 시간을 계산하지 않아요</p>
        ) : !hasDestination ? (
          <p className={styles.notice}>출퇴근 장소를 정하면 이 집에서 가는 노선을 알려 드려요</p>
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
        <div className={styles.infra} role="group" aria-label="주변 인프라">
          <h3 className={styles.heading}>주변 인프라</h3>
          {latitude === null || longitude === null ? (
            <p className={styles.notice}>
              {isPreview
                ? '예시 매물이라 주변 정보를 계산하지 않아요'
                : '매물 위치가 없어 주변 정보를 계산하지 못했어요'}
            </p>
          ) : (
            <PropertyNearbyPreview
              propertyId={property.propertyId}
              latitude={latitude}
              longitude={longitude}
              showMap={false}
            />
          )}
        </div>
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

    /* 옆 칸: 위 요약은 카드 높이만큼, 아래 노선이 나머지를 쓰고 길면 스크롤한다. */
    &[data-layout='split'] {
      height: 100%;
      grid-template-rows: auto minmax(0, 1fr);
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

  head: css`
    label: FinderPropertyPanel-head;
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.25rem;
  `,

  listLink: css`
    label: FinderPropertyPanel-listLink;
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.15rem 0;
    border: 0;
    background: none;
    color: var(--color-brand-blue-ink);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
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

  infra: css`
    label: FinderPropertyPanel-infra;
    display: grid;
    gap: 0.35rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border);
  `,

  notice: css`
    label: FinderPropertyPanel-notice;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.85rem;
  `,
};

export default FinderPropertyPanel;
