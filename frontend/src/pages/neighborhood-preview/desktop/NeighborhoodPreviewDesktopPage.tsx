import { Fragment } from 'react';
import { Outlet, useMatch } from 'react-router-dom';

import { SERVICE_MAP_STYLE_ID } from '@/features/map/lib/mapStyle';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import ListDetailLayout from '@/shared/ui/list-detail-layout/ListDetailLayout';
import RankedCard from '@/shared/ui/ranked-card/RankedCard';

import useNeighborhoodMapView from '../hooks/useNeighborhoodMapView';
import type { NeighborhoodPreviewContext } from '../hooks/useNeighborhoodPreview';
import { COMMUTE_COLORS, commuteLegend } from '../model/commuteColors';
import { areaCardDescription, emptyAreaMessage, transferLabel } from '../model/criteriaLabels';
import { RENT_OPTIONS } from '../NeighborhoodFilters';
import AnalysisOverlay from '../ui/analysis-overlay/AnalysisOverlay';
import AreaSummary from '../ui/area-summary/AreaSummary';
import ConditionPanel from '../ui/condition-panel/ConditionPanel';
import LocationControls from '../ui/location-controls/LocationControls';
import NeighborhoodMapSearch from '../ui/map-search/NeighborhoodMapSearch';
import MapTapHint from '../ui/map-tap-hint/MapTapHint';
import NeighborhoodPlacePanel from '../ui/place-panel/NeighborhoodPlacePanel';

import shared from '../NeighborhoodPreviewPage.module.css';
import styles from './NeighborhoodPreviewDesktopPage.module.css';

const CARD_RANKS = [1, 2, 3, 4, 5] as const;

type Props = {
  preview: NeighborhoodPreviewContext;
};

/**
 * 데스크탑 동네 찾기. 본 방 기록처럼 왼쪽 칸에서 조작하고 지도는 오른쪽에 둔다.
 * 고를 때는 왼쪽 칸에 조건을, 결과에서는 기준 요약과 상위 동네를 두고, 대중교통 상세는 목록 옆 칸에 붙여 연다.
 */
const NeighborhoodPreviewDesktopPage = ({ preview }: Props) => {
  const isRoutePage = useMatch(`${preview.mapPath}/areas/:adminDongCode/*`);
  const isDetailPage = useMatch(`${preview.mapPath}/areas/:adminDongCode/details`);
  const submitSearch = preview.startAnalysis;
  const { isResultMap, mapProps, places } = useNeighborhoodMapView(preview, { showAreaAction: false });
  const recordArea = preview.selected ?? preview.topAreas[0];
  const hasDetail = isResultMap && !!isDetailPage;

  const list = isResultMap ? (
    <aside className={styles.areaPanel} aria-label="통근 시간 상위 동네">
      <header className={styles.areaHeader}>
        <div>
          <h2>통근 시간 상위 동네</h2>
          <p>
            {preview.destination.name}까지 · {preview.regions.length}곳
          </p>
        </div>
        <Button
          variant="secondary"
          className={styles.reselect}
          onClick={() => {
            places.closePlace();
            preview.reset();
          }}
        >
          <Icon name="refresh" size={18} />
          다시 선택하기
        </Button>
      </header>
      <div className={styles.criteria} aria-label="선택한 탐색 조건">
        <span>통근 {preview.maxMinutes}분 이내</span>
        <span>{transferLabel(preview.maxTransfers)}</span>
        {/* 월세는 받은 시세를 거르는 조건이라 결과에서도 다시 찾지 않고 바로 바꾼다. */}
        <select
          aria-label="최대 월세 시세"
          value={preview.maxRent}
          onChange={(event) => preview.changeMaxRent(Number(event.target.value))}
        >
          {RENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value === 0 ? '월세 전체' : `월세 ${option.label}`}
            </option>
          ))}
        </select>
      </div>
      {preview.topAreas.length > 0 ? (
        <div className={styles.areaList}>
          {/* 동네를 고르면 경로를 바로 그리지 않고 카드 아래에 시세·출발 정류장을 펼친다. 정류장을 고르면 가운데 칸에 경로를 연다. */}
          {preview.topAreas.map((area, index) => {
            const isSelected = preview.selected?.adminDongCode === area.adminDongCode;
            return (
              <Fragment key={area.adminDongCode}>
                <RankedCard
                  rank={CARD_RANKS[index]}
                  title={area.name}
                  value={area.commuteMinutes}
                  unit="분"
                  description={areaCardDescription(area)}
                  selected={isSelected}
                  onSelect={() => {
                    places.closePlace();
                    preview.selectRegion(area.adminDongCode, { openDetails: false });
                  }}
                />
                {isSelected && preview.selected && (
                  <AreaSummary
                    area={preview.selected}
                    selectedStopId={
                      places.selectedPlace?.kind === 'station' ? places.selectedPlace.station.stopId : null
                    }
                    onSelectStation={(station) => {
                      places.selectStation(station);
                      // 출발 정류장을 바꾼 지표(commute_departure_station_changed)는 동네 요약 목록에서 고를 때 남긴다.
                      preview.selectStation(station.stopId);
                    }}
                    onOpenListing={preview.openListing}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      ) : (
        <p className={styles.empty} role="status">
          {emptyAreaMessage(preview.maxRent)}
        </p>
      )}
    </aside>
  ) : (
    <ConditionPanel preview={preview} disabled={preview.isAnalyzing} onSubmit={submitSearch} />
  );

  return (
    <main className={`${shared.page} ${styles.page}`} data-public-explore={preview.isPublicExplore || undefined}>
      <ListDetailLayout
        list={list}
        // 지도에서 고른 정류장·부동산이 있으면 그 정보를, 없으면 동네 대중교통 상세를 목록 옆 칸에 연다.
        // 정보를 닫으면 보고 있던 동네 상세로 돌아간다.
        detail={
          places.selectedPlace ? (
            <NeighborhoodPlacePanel place={places.selectedPlace} preview={preview} />
          ) : hasDetail ? (
            <Outlet context={preview} />
          ) : undefined
        }
        onCloseDetail={places.selectedPlace ? places.closePlace : preview.closeAreaDetails}
        closeLabel={places.selectedPlace ? '정보 닫기' : '대중교통 상세 닫기'}
      >
        <section className={shared.mapPage} aria-label={isResultMap ? '행정동 프리셋 지도' : '지도에서 목적지 선택'}>
          <MapCanvas
            animateView
            customStyleId={SERVICE_MAP_STYLE_ID}
            hideLoading={preview.isAnalyzing || Boolean(preview.error)}
            interactive
            {...mapProps}
          />
          <AnalysisOverlay preview={preview} />
          {preview.isSelectingOnMap && (
            <>
              <header className={shared.searchHeader}>
                <NeighborhoodMapSearch preview={preview} />
              </header>
              <LocationControls preview={preview} isResult={false} />
              {!preview.hasChosenMapPoint && !preview.query.trim() && preview.addressResults.length === 0 && (
                <MapTapHint />
              )}
            </>
          )}
          {isResultMap && (
            <>
              {/* 지도 색이 무엇을 뜻하는지는 지도 위에 둔다. 상세 닫기 버튼은 이 상자 아래에 뜬다. */}
              <div className={`${shared.colorLegend} ${styles.legend}`} aria-label="통근 시간 색상 기준">
                {commuteLegend(preview.maxMinutes).map(([group, label]) => (
                  <span key={group}>
                    <i style={{ background: COMMUTE_COLORS[group].fillColor }} />
                    {label}
                  </span>
                ))}
                <small className={shared.placesHint}>
                  {places.isClose
                    ? places.failed
                      ? '주변 정류장·부동산을 불러오지 못했어요'
                      : '정류장·부동산을 눌러 정보를 볼 수 있어요'
                    : '동네를 고르거나 가까이 확대하면 정류장·부동산이 보여요'}
                </small>
              </div>
              <LocationControls preview={preview} isResult />
              {preview.isPublicExplore && recordArea && (
                <div className={`${shared.recordAction} ${styles.recordAction}`}>
                  <ExplorationRecordAction
                    location={{
                      ...recordArea.center,
                      address: recordArea.fullName,
                      roadAddress: null,
                      jibunAddress: recordArea.fullName,
                    }}
                  />
                </div>
              )}
              {/* 동네만 고른 주소(`areas/:code`)는 화면을 그리지 않고, 저장된 검색이 없을 때의 안내만 맡는다. */}
              {isRoutePage && !isDetailPage && <Outlet context={preview} />}
            </>
          )}
        </section>
      </ListDetailLayout>
    </main>
  );
};

export default NeighborhoodPreviewDesktopPage;
