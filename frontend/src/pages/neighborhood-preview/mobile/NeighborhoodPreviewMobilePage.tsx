import { useState } from 'react';
import { Outlet, useMatch } from 'react-router-dom';

import { SERVICE_MAP_STYLE_ID } from '@/features/map/lib/mapStyle';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';
import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import { Button } from '@/shared/ui/button/Button';
import HorizontalRail from '@/shared/ui/horizontal-rail/HorizontalRail';
import Icon from '@/shared/ui/icon/Icon';
import RankedCard from '@/shared/ui/ranked-card/RankedCard';

import useNeighborhoodMapView from '../hooks/useNeighborhoodMapView';
import type { NeighborhoodPreviewContext } from '../hooks/useNeighborhoodPreview';
import { COMMUTE_COLORS, commuteLegend } from '../model/commuteColors';
import { areaCardDescription, emptyAreaMessage, rentLabel, transferLabel } from '../model/criteriaLabels';
import type { NeighborhoodFilterField } from '../NeighborhoodFilters';
import NeighborhoodFilters from '../NeighborhoodFilters';
import AnalysisOverlay from '../ui/analysis-overlay/AnalysisOverlay';
import LocationControls from '../ui/location-controls/LocationControls';
import NeighborhoodMapSearch from '../ui/map-search/NeighborhoodMapSearch';
import MapTapHint from '../ui/map-tap-hint/MapTapHint';
import NeighborhoodPlaceSheet from '../ui/place-panel/NeighborhoodPlaceSheet';

import shared from '../NeighborhoodPreviewPage.module.css';

const CARD_RANKS = [1, 2, 3, 4, 5] as const;

type Props = {
  preview: NeighborhoodPreviewContext;
};

/**
 * 휴대폰 동네 찾기. 지도를 화면 전체에 두고 조건은 지도 위 칩·바텀시트로, 결과는 지도 아래 가로 레일로 고른다.
 * 대중교통 상세는 지도 없이 화면 전체로 연다.
 */
const NeighborhoodPreviewMobilePage = ({ preview }: Props) => {
  const [filterField, setFilterField] = useState<NeighborhoodFilterField | null>(null);
  const isRoutePage = useMatch(`${preview.mapPath}/areas/:adminDongCode/*`);
  const isDetailPage = useMatch(`${preview.mapPath}/areas/:adminDongCode/details`);
  const submitSearch = preview.startAnalysis;
  const { isResultMap, mapProps, places } = useNeighborhoodMapView(preview);
  const recordArea = preview.selected ?? preview.topAreas[0];

  if (isDetailPage && !preview.isAnalyzing && !preview.error)
    return (
      <div className={shared.page}>
        <Outlet context={preview} />
      </div>
    );
  return (
    <main className={shared.page} data-public-explore={preview.isPublicExplore || undefined}>
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
              {!preview.hasChosenMapPoint && (
                <>
                  {preview.isSearching && (
                    <p className={shared.mapSearchResult} role="status">
                      주소를 찾고 있어요.
                    </p>
                  )}
                  {preview.searchError && (
                    <p className={shared.mapSearchResult} role="alert">
                      {preview.searchError}
                    </p>
                  )}
                  {preview.addressResults.map((address) => (
                    <button
                      className={shared.mapSearchResult}
                      key={`${address.latitude}-${address.longitude}`}
                      onClick={() => preview.selectAddress(address)}
                    >
                      {address.roadAddress ?? address.jibunAddress ?? address.address}
                    </button>
                  ))}
                </>
              )}
              <div className={shared.filterChips} aria-label="탐색 조건">
                <Button
                  variant="secondary"
                  aria-expanded={filterField === 'minutes'}
                  onClick={() => setFilterField('minutes')}
                >
                  <span>통근 {preview.maxMinutes}분 이내</span>
                  <Icon name="chevron-down" size={16} />
                </Button>
                <Button
                  variant="secondary"
                  aria-expanded={filterField === 'transfers'}
                  onClick={() => setFilterField('transfers')}
                >
                  <span>{transferLabel(preview.maxTransfers)}</span>
                  <Icon name="chevron-down" size={16} />
                </Button>
                <Button
                  variant="secondary"
                  aria-expanded={filterField === 'rent'}
                  onClick={() => setFilterField('rent')}
                >
                  <span>{rentLabel(preview.maxRent)}</span>
                  <Icon name="chevron-down" size={16} />
                </Button>
              </div>
            </header>
            <LocationControls preview={preview} isResult={false} isFilterOpen={filterField !== null} />
            {!preview.hasChosenMapPoint &&
              filterField === null &&
              !preview.query.trim() &&
              preview.addressResults.length === 0 && <MapTapHint />}
            {/* 위치를 고르면 아래에 `{장소}에서 찾기` 버튼을 올린다. 지도 위 버튼은 말풍선 핀과 겹쳐 두지 않는다. */}
            {preview.hasChosenMapPoint && filterField === null && (
              <section className={shared.searchCard} aria-label="고른 출퇴근 장소">
                <Button fullWidth disabled={!preview.isValidCommuteTime} onClick={submitSearch}>
                  <span className={shared.searchCardLabel}>
                    <span>{preview.mapCandidate.name}</span>에서 찾기
                  </span>
                </Button>
              </section>
            )}
            {filterField !== null && (
              <BottomSheet
                title={filterField === 'minutes' ? '통근 시간' : filterField === 'rent' ? '월세 시세' : '환승 횟수'}
                initialHeightPercent={filterField !== 'transfers' ? 55 : 32}
                resizable={false}
                onClose={() => setFilterField(null)}
              >
                <NeighborhoodFilters
                  key={filterField}
                  preview={preview}
                  field={filterField}
                  onClose={() => setFilterField(null)}
                />
              </BottomSheet>
            )}
          </>
        )}
        {isResultMap && (
          <>
            <header className={shared.resultHeader}>
              <Button
                variant="secondary"
                className={shared.resultBack}
                onClick={() => {
                  places.closePlace();
                  preview.reset();
                }}
              >
                <Icon name="refresh" size={26} />
                다시 선택하기
              </Button>
              <div className={shared.resultCriteria}>
                <div className={shared.criteriaBadges} aria-label="선택한 탐색 조건">
                  <span>통근 {preview.maxMinutes}분 이내</span>
                  <span>{transferLabel(preview.maxTransfers)}</span>
                  {/* 월세는 받은 시세를 거르는 조건이라 결과에서도 다시 찾지 않고 바로 바꾼다. */}
                  <Button variant="secondary" className={shared.filterBadge} onClick={() => setFilterField('rent')}>
                    {rentLabel(preview.maxRent)} <Icon name="chevron-down" size={16} />
                  </Button>
                </div>
                <div className={shared.colorLegend} aria-label="통근 시간 색상 기준">
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
              </div>
            </header>
            <LocationControls preview={preview} isResult />
            {preview.isPublicExplore && recordArea && (
              <div className={shared.recordAction}>
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
            {preview.regions.length === 0 && (
              <div className={shared.resultControls}>
                <p className={shared.selectedInfo} role="status">
                  {emptyAreaMessage(preview.maxRent)}
                </p>
              </div>
            )}
            {!isRoutePage && preview.topAreas.length > 0 && (
              <div className={shared.topAreaRail} aria-label="통근 시간 상위 동네">
                <HorizontalRail className={shared.areaCards}>
                  {preview.topAreas.map((area, index) => (
                    <RankedCard
                      key={area.adminDongCode}
                      className={shared.areaCard}
                      rank={CARD_RANKS[index]}
                      title={area.name}
                      value={area.commuteMinutes}
                      unit="분"
                      description={areaCardDescription(area)}
                      selected={preview.selected?.adminDongCode === area.adminDongCode}
                      onSelect={() => preview.selectRegion(area.adminDongCode)}
                    />
                  ))}
                </HorizontalRail>
              </div>
            )}
            {places.selectedPlace && (
              <NeighborhoodPlaceSheet place={places.selectedPlace} preview={preview} onClose={places.closePlace} />
            )}
            {isRoutePage && <Outlet context={preview} />}
            {filterField === 'rent' && (
              <BottomSheet
                title="월세 시세"
                initialHeightPercent={55}
                resizable={false}
                onClose={() => setFilterField(null)}
              >
                <NeighborhoodFilters preview={preview} field="rent" onClose={() => setFilterField(null)} />
              </BottomSheet>
            )}
          </>
        )}
      </section>
    </main>
  );
};

export default NeighborhoodPreviewMobilePage;
