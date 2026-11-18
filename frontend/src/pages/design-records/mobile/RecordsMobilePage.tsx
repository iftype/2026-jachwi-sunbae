import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import usePreloadMapSdk from '@/features/map/hooks/usePreloadMapSdk';
import { readSearchedAddress } from '@/features/map/lib/searchedAddressState';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import AreaSkeleton from '@/shared/ui/area-skeleton/AreaSkeleton';
import { useMapPanel } from '@/shared/ui/map-list-header/MapPanelContext';
import MapViewSwitch from '@/shared/ui/map-view-switch/MapViewSwitch';

import type { RecordsState } from '../hooks/useRecords';
import type { RecordsMapLayers } from '../hooks/useRecordsMapLayers';
import useRecordsView from '../hooks/useRecordsView';
import { RECORDS_LOADING_LABEL } from '../RecordsPageSkeleton';
import RecordDistricts from '../ui/record-districts/RecordDistricts';
import RecordList from '../ui/record-list/RecordList';
import RecordLoadError from '../ui/record-load-error/RecordLoadError';
import RecordNotice from '../ui/record-notice/RecordNotice';
import RecordsMobileHeader from './RecordsMobileHeader';
import RecordsMobileMap from './RecordsMobileMap';

import * as styles from './RecordsMobilePage.styles';

/**
 * 휴대폰·태블릿 본 방 기록. 위에서 지도·리스트를 바꿔 보고, 지도 보기에서는 헤더와 동네 뱃지를 지도 위에 띄운다.
 * 지도에서 고른 방은 지도 아래 바텀시트로, 리스트에서 고른 방은 상세 화면으로 연다.
 * 지도는 예전 인프라 지도의 시설·거리 메모 카테고리와 찍은 위치의 메모·매물 등록을 함께 맡는다.
 */
type Props = { records: RecordsState; layers: RecordsMapLayers; searchTo?: string };
const RecordsMobilePage = ({ records, layers, searchTo }: Props) => {
  const panel = useMapPanel();
  const navigate = useNavigate();
  const { setNotice, searchTo: moveTo } = records;
  const location = useLocation();
  // 주소 검색 화면에서 고른 주소가 오면 그 자리로 지도를 옮긴다. 새로고침해도 다시 옮기지 않도록 바로 비운다.
  const searchedAddress = useMemo(
    () => (location.pathname === RECORDS_PATH ? readSearchedAddress(location.state) : null),
    [location.pathname, location.state],
  );
  useEffect(() => {
    if (!searchedAddress) return;
    moveTo(searchedAddress);
    navigate(`${RECORDS_PATH}?view=map`, { replace: true, state: null });
  }, [searchedAddress, moveTo, navigate]);
  const [view, setView] = useRecordsView();
  const showsMap = view === 'map';
  // 지도는 매물 목록이 온 뒤에 붙으므로, 목록을 기다리는 동안 지도 SDK를 먼저 받기 시작한다.
  usePreloadMapSdk(showsMap);
  // 헤더·동네 뱃지는 지도 보기에서 지도(불러오는 중 뼈대 포함) 위에 띄워, 지도가 나오기 전에도 헤더만 흰 띠로 남지 않게 한다.
  // 실패 안내는 가리지 않도록 제외한다.
  const overMap = !panel && showsMap && !records.properties.isError;
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={overMap ? styles.mapChrome : undefined}>
          <h1 ref={records.headingRef} className="sr-only" tabIndex={-1}>
            본 방 기록
          </h1>
          {!panel && <RecordsMobileHeader view={view} searchTo={searchTo} onViewChange={setView} />}
          {/* 기록을 받는 동안과 마이 같은 다른 화면(패널)을 볼 때는 동네 칩 줄을 두지 않는다. */}
          {!panel && showsMap && !records.properties.isPending && (
            <RecordDistricts
              districts={records.districts}
              counts={records.districtCounts}
              district={records.district}
              onSelect={(next) => records.selectDistrict(next, { open: true })}
              overMap={overMap}
            />
          )}
        </div>
        <div className={styles.body}>
          {/* 처음 여는 화면이라 남겨 둘 목록이 없다. 늦추지 않고 바로 뼈대를 보여, 화면 코드를 받는 동안의 뼈대에서 이어지게 한다.
              뼈대는 지금 보기 방식의 영역(지도, 리스트) 하나만 채운다. */}
          {panel ? (
            panel.content
          ) : records.properties.isPending ? (
            <AreaSkeleton area={showsMap ? 'map' : 'list'} label={RECORDS_LOADING_LABEL} />
          ) : records.properties.isError ? (
            <RecordLoadError
              className={styles.list}
              error={records.properties.error}
              onRetry={() => void records.properties.refetch()}
            />
          ) : showsMap ? (
            <RecordsMobileMap records={records} layers={layers} />
          ) : (
            <RecordList
              className={styles.list}
              records={records.records}
              district={records.district}
              onNotice={setNotice}
              showCompare={!panel}
            />
          )}
        </div>
        {!panel && <MapViewSwitch value={view} onChange={setView} label="기록 보기 방식" />}
        <RecordNotice message={records.notice} onClose={() => setNotice('')} />
      </div>
    </main>
  );
};

export default RecordsMobilePage;
