import { css } from '@emotion/css';

import type { NeighborhoodPlace } from '../../hooks/useNeighborhoodPlaces';
import { placeTitle } from '../../hooks/useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import { commuteColor } from '../../model/commuteColors';
import { formatRentPair, overRentNotice } from '../../model/criteriaLabels';
import type { MyPropertyRow } from '../../model/myProperty';
import { propertyCommuteLabel, propertyCommuteOrder } from '../../model/propertyCommute';
import ListingLink from '../listing-link/ListingLink';
import PlaceDetails from '../place-panel/PlaceDetails';

type Area = NonNullable<NeighborhoodPreviewContext['selected']>;
type My = { rows: MyPropertyRow[]; maxMinutes: number; isLoading: boolean; isError: boolean };

/** 지금 보여 줄 정보 하나. 누른 마커가 가장 앞이고, 없으면 고른 동네, 그다음 `My` 목록이다. */
export type MapInfoSubject =
  { kind: 'place'; place: NeighborhoodPlace } | { kind: 'area'; area: Area } | { kind: 'my' };

export const mapInfoTitle = (subject: MapInfoSubject) =>
  subject.kind === 'place'
    ? `${placeTitle(subject.place)} 정보`
    : subject.kind === 'area'
      ? subject.area.name
      : '내 매물 통근 시간';

type Props = {
  subject: MapInfoSubject;
  preview: Pick<
    NeighborhoodPreviewContext,
    'destination' | 'maxMinutes' | 'maxTransfers' | 'rentPeriod' | 'maxRent' | 'openListing' | 'isPublicExplore'
  >;
  my: My;
  onSelectProperty: (row: MyPropertyRow) => void;
  /** 휴대폰은 바로 전화를 걸고, 데스크탑은 번호를 보여 주고 복사하게 한다. */
  phoneAction: 'call' | 'copy';
};

/**
 * 결과 지도의 정보 한 단계. 휴대폰 시트와 데스크탑 지도 아래 카드가 함께 쓴다.
 * 누른 마커 하나의 정보, 고른 동네 정보, `My` 매물 목록 가운데 하나만 보인다. 목록에서 다른 단계로 넘어가지 않는다.
 */
const MapInfo = ({ subject, preview, my, onSelectProperty, phoneAction }: Props) => {
  if (subject.kind === 'place')
    return (
      <PlaceDetails
        place={subject.place}
        preview={preview}
        phoneAction={phoneAction}
        commuteMaxMinutes={my.maxMinutes}
      />
    );
  if (subject.kind === 'area') {
    const { area } = subject;
    const overRent = overRentNotice(area.rent, preview.maxRent);
    return (
      <div className={styles.body}>
        <p className={styles.subtitle}>{area.fullName}</p>
        <div className={styles.summary}>
          <dl className={styles.facts}>
            <dt>소요시간</dt>
            <dd className={styles.commute}>
              {/* 시간은 통근 색(15분 이하 파랑 등)의 뱃지로, 뒤에 가는 방법(출발 정류장)을 붙인다. */}
              <b style={{ background: commuteColor(area.commuteMinutes).fillColor }}>{area.commuteMinutes}분</b>
              {area.stations[0] && <span>{area.stations[0].stopName}에서 출발</span>}
            </dd>
            <dt>월세 시세</dt>
            <dd>{area.rent ? formatRentPair(area.rent) : '거래가 적어 시세를 내지 않았어요'}</dd>
          </dl>
          {/* 다방 링크는 정보 글 오른쪽에 정사각형 타일로 고정한다. */}
          <ListingLink areaName={area.name} center={area.center} onOpen={preview.openListing} />
        </div>
        {overRent && <p className={styles.notice}>{overRent}</p>}
      </div>
    );
  }
  const rows = [...my.rows].sort(
    (left, right) => propertyCommuteOrder(left.commute) - propertyCommuteOrder(right.commute),
  );
  return (
    <section className={styles.body} aria-label="내 매물 통근 시간 목록">
      <p className={styles.subtitle}>내 매물에서 {preview.destination.name}까지</p>
      {preview.isPublicExplore ? (
        <p className={styles.empty}>
          로그인하고 본 방을 기록하면 매물마다 이번 출퇴근 장소까지 통근 시간을 볼 수 있어요.
        </p>
      ) : my.isLoading ? (
        <p className={styles.empty}>내 매물을 불러오고 있어요.</p>
      ) : my.isError ? (
        <p className={styles.empty}>내 매물을 불러오지 못했어요.</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>
          아직 기록한 매물이 없어요. 본 방 기록에서 매물을 남기면 여기에서 통근 시간을 볼 수 있어요.
        </p>
      ) : (
        <ul className={styles.items}>
          {rows.map((row) => (
            <li key={row.propertyId}>
              <button type="button" onClick={() => onSelectProperty(row)}>
                <span>{row.name}</span>
                <small data-status={row.commute?.status}>
                  {row.commute ? propertyCommuteLabel(row.commute, my.maxMinutes) : '…'}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const styles = {
  body: css`
    label: MapInfo-body;
    display: grid;
    gap: 0.6rem;
  `,

  subtitle: css`
    label: MapInfo-subtitle;
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.8rem;
  `,

  summary: css`
    label: MapInfo-summary;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  `,

  facts: css`
    label: MapInfo-facts;
    flex: 1;
    min-width: 0;
    align-content: center;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.35rem 0.75rem;
    margin: 0;
    font-size: 0.85rem;

    & dt {
      color: var(--color-muted);
    }

    & dd {
      display: grid;
      gap: 0.15rem;
      margin: 0;
      font-weight: 600;
    }

    & small {
      color: var(--color-muted);
      font-size: 0.75rem;
      font-weight: 500;
    }
  `,

  /* 소요시간: 색 뱃지와 가는 방법을 한 줄에 놓는다. */
  commute: css`
    label: MapInfo-commute;
    display: flex !important;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem !important;

    & b {
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      color: #fff;
      font-size: 0.8rem;
      font-weight: 800;
    }
    & span {
      color: var(--color-ink);
      font-weight: 600;
    }
  `,

  notice: css`
    label: MapInfo-notice;
    margin: 0;
    color: var(--color-danger, #d14d4d);
    font-size: 0.78rem;
    font-weight: 600;
  `,

  empty: css`
    label: MapInfo-empty;
    margin: 0;
    padding: 0.4rem 0;
    color: var(--color-muted);
    font-size: 0.85rem;
  `,

  items: css`
    label: MapInfo-items;
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;

    & button {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.7rem 0.25rem;
      border: 0;
      border-bottom: 1px solid var(--color-border);
      background: none;
      color: var(--color-ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    & button:hover {
      background: var(--color-surface-muted);
    }

    & span {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      font-size: 0.9rem;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & small {
      flex: none;
      color: var(--color-muted);
      font-size: 0.78rem;
    }

    & small[data-status='REACHABLE'] {
      color: var(--color-primary-dark);
      font-weight: 700;
    }
  `,
};

export default MapInfo;
