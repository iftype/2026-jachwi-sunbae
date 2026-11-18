import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import Icon from '@/shared/ui/icon/Icon';

import { propertyCommuteOrder } from '../model/propertyCommute';
import type { MapInfoSubject } from '../ui/map-info/MapInfo';
import type useNeighborhoodMapView from './useNeighborhoodMapView';

type MapView = ReturnType<typeof useNeighborhoodMapView>;

/**
 * `My` 목록에서 고른 매물의 시트 도구. 목록 순서대로 이전과 다음 매물로 옮기고(처음과 끝은 이어진다),
 * 뒤로가기는 고른 매물만 닫아 `My` 목록으로 돌아간다. 다른 정보를 보고 있으면 `null`이다.
 */
const useMyPropertyPager = (subject: MapInfoSubject | null, mapView: MapView) => {
  if (subject?.kind !== 'place' || subject.place.kind !== 'property' || !mapView.showsMy) return null;
  const current = subject.place.property;
  const rows = [...mapView.my.rows].sort(
    (left, right) => propertyCommuteOrder(left.commute) - propertyCommuteOrder(right.commute),
  );
  const index = rows.findIndex((row) => row.propertyId === current.propertyId);
  if (index < 0) return null;
  const step = (delta: number) => mapView.selectMyProperty(rows[(index + delta + rows.length) % rows.length]);
  const controls: ReactNode = (
    <span className={styles.pager}>
      <button type="button" aria-label="이전 매물" onClick={() => step(-1)} disabled={rows.length < 2}>
        <Icon name="chevron-left" size={18} />
      </button>
      <span aria-live="polite">
        {index + 1}/{rows.length}
      </span>
      <button type="button" aria-label="다음 매물" onClick={() => step(1)} disabled={rows.length < 2}>
        <Icon name="chevron-right" size={18} />
      </button>
    </span>
  );
  return { backToList: mapView.places.closePlace, controls };
};

const styles = {
  pager: css`
    label: MyPropertyPager-pager;
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    margin-right: 0.9rem;
    color: var(--color-muted);
    font-size: 0.8rem;

    & button {
      display: grid;
      width: 1.9rem;
      height: 1.9rem;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--color-ink);
      cursor: pointer;
    }

    & button:disabled {
      opacity: 0.35;
      cursor: default;
    }
  `,
};

export default useMyPropertyPager;
