import { useCallback, useMemo, useState } from 'react';
import { Navigate, Outlet, useMatch } from 'react-router-dom';

import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCurrentLocationButton from '@/features/map/ui/map-current-location-button/MapCurrentLocationButton';
import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';
import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import { Button } from '@/shared/ui/button/Button';
import HorizontalRail from '@/shared/ui/horizontal-rail/HorizontalRail';
import Icon from '@/shared/ui/icon/Icon';
import RankedCard from '@/shared/ui/ranked-card/RankedCard';
import SearchField from '@/shared/ui/search-field/SearchField';
import Toast from '@/shared/ui/toast/Toast';

import useExplorationTutorial from './hooks/useExplorationTutorial';
import useNeighborhoodPreview from './hooks/useNeighborhoodPreview';
import { COMMUTE_COLORS, commuteLegend } from './model/commuteColors';
import type { NeighborhoodFilterField } from './NeighborhoodFilters';
import NeighborhoodFilters from './NeighborhoodFilters';
import ExplorationTip from './ui/exploration-tip/ExplorationTip';

import styles from './NeighborhoodPreviewPage.module.css';

const CARD_RANKS = [1, 2, 3, 4, 5] as const;
const NEIGHBORHOOD_MAP_STYLE_ID = '631c1c09-380e-427f-b7d8-e600956dac10';

const NeighborhoodPreviewPage = () => {
  const preview = useNeighborhoodPreview();
  const tutorial = useExplorationTutorial({
    enabled: preview.isPublicExplore,
    mode: preview.mode,
    hasLocation: preview.hasChosenMapPoint,
    mock: preview.isMockData,
  });
  const [filterField, setFilterField] = useState<NeighborhoodFilterField | null>(null);
  const [isEntryToastOpen, setEntryToastOpen] = useState(true);
  const closeEntryToast = useCallback(() => setEntryToastOpen(false), []);
  const isRoutePage = useMatch(`${preview.mapPath}/areas/:adminDongCode/*`);
  const isDetailPage = useMatch(`${preview.mapPath}/areas/:adminDongCode/details`);
  const isPriceDetailPage = useMatch(`${preview.mapPath}/prices/:legalDongCode`);
  const recordArea = preview.selected ?? preview.selectedPrice ?? preview.topAreas[0] ?? preview.priceAreas[0];
  const currentMarkers = useMemo(
    () =>
      preview.currentPosition
        ? [{ ...preview.currentPosition, id: 'current-location', label: '현재 위치', tone: 'current' as const }]
        : [],
    [preview.currentPosition],
  );
  const destinationMarkers = useMemo(
    () => [
      ...currentMarkers,
      { ...preview.destination, id: 'destination', label: preview.destination.name, tone: 'selected' as const },
    ],
    [preview.destination, currentMarkers],
  );
  const candidateMarkers = useMemo(
    () => [
      ...currentMarkers,
      ...(preview.hasChosenMapPoint
        ? [{ ...preview.mapCandidate, id: 'candidate', label: '선택한 목적지', tone: 'selected' as const }]
        : []),
    ],
    [preview.mapCandidate, preview.hasChosenMapPoint, currentMarkers],
  );
  const locationControls = (
    <div
      className={styles.locationControls}
      data-result={!preview.isSelectingOnMap || undefined}
      data-filter-open={(preview.isSelectingOnMap && filterField !== null) || undefined}
    >
      {(preview.isLocating || preview.locationError) && (
        <span className={styles.locationStatus} role={preview.locationError ? 'alert' : 'status'}>
          {preview.isLocating ? '현재 위치를 확인하는 중이에요.' : preview.locationError}
        </span>
      )}
      <MapCurrentLocationButton isLocating={preview.isLocating} onClick={preview.moveToCurrentLocation} />
    </div>
  );
  if (
    ((isRoutePage && !preview.selected) || (isPriceDetailPage && !preview.selectedPrice)) &&
    !preview.isAnalyzing &&
    !preview.error
  ) {
    return <Navigate to={`${preview.mapPath}?mode=${preview.mode}`} replace />;
  }
  if ((isDetailPage || isPriceDetailPage) && !preview.isAnalyzing && !preview.error)
    return (
      <div className={styles.page}>
        <Outlet context={preview} />
      </div>
    );
  return (
    <main className={styles.page} data-public-explore={preview.isPublicExplore || undefined}>
      {preview.isAnalyzing ? (
        <section className={styles.analysis}>
          <div className={styles.spinner} aria-hidden="true" />
          <h1>주변 동네를 분석하고 있어요</h1>
          <p>{preview.destination.name} 기준</p>
          <p role="status" aria-live="polite">
            {preview.showPrice
              ? '법정동 경계와 주변 동네의 월세 거래를 불러오고 있어요.'
              : `최대 ${preview.maxMinutes}분 안에 통근할 수 있는 동네를 찾고 있어요.`}
          </p>
          <small>
            {preview.isMockData ? 'MSW 샘플 응답을 기다리고 있어요.' : '서버에서 통근 가능한 동네를 계산하고 있어요.'}
          </small>
          <Button variant="text" onClick={preview.reset}>
            취소
          </Button>
        </section>
      ) : preview.error ? (
        <section className={styles.analysis}>
          <h1>동네를 불러오지 못했어요</h1>
          <p role="alert">{preview.error}</p>
          <Button variant="secondary" onClick={preview.retry}>
            다시 시도
          </Button>
          <Button variant="text" onClick={preview.reset}>
            목적지 다시 입력
          </Button>
        </section>
      ) : preview.isSelectingOnMap ? (
        <section className={styles.mapPage} aria-label="지도에서 목적지 선택">
          <MapCanvas
            animateView
            customStyleId={NEIGHBORHOOD_MAP_STYLE_ID}
            center={preview.selectionCenter}
            level={preview.selectionLevel}
            interactive
            markers={candidateMarkers}
            onSelectLocation={(latitude, longitude) => {
              preview.chooseMapPoint(latitude, longitude);
            }}
            coordinateAction={
              preview.hasChosenMapPoint
                ? {
                    ...preview.mapCandidate,
                    label: '선택한 조건으로 찾기',
                    disabled: preview.showCommute && !preview.isValidCommuteTime,
                    onClick: () => {
                      tutorial.complete();
                      preview.startAnalysis();
                    },
                  }
                : undefined
            }
          />
          <header className={styles.searchHeader} data-tutorial-step={tutorial.isOpen ? tutorial.step : undefined}>
            <div className={styles.mapSearch}>
              <SearchField
                className={styles.activeSearchField}
                shape="pill"
                showSubmitButton
                label={preview.mode === 'commute' ? '출퇴근 장소' : '관심 지역'}
                placeholder={preview.mode === 'commute' ? '출퇴근하는 장소 검색' : '관심 지역 검색'}
                value={preview.query}
                onValueChange={preview.changeQuery}
                onSubmit={() => {
                  preview.searchDestination();
                }}
                onBack={preview.openModeSelection}
                autoFocus={preview.shouldFocusMapSearch}
              />
            </div>
            {!preview.hasChosenMapPoint && (
              <>
                {preview.isSearching && (
                  <p className={styles.mapSearchResult} role="status">
                    주소를 찾고 있어요.
                  </p>
                )}
                {preview.searchError && (
                  <p className={styles.mapSearchResult} role="alert">
                    {preview.searchError}
                  </p>
                )}
                {preview.addressResults.map((address) => (
                  <button
                    className={styles.mapSearchResult}
                    key={`${address.latitude}-${address.longitude}`}
                    onClick={() => preview.selectAddress(address)}
                  >
                    {address.roadAddress ?? address.jibunAddress ?? address.address}
                  </button>
                ))}
              </>
            )}
            {tutorial.isOpen && filterField === null && (tutorial.step !== 'location' || !preview.query.trim()) && (
              <ExplorationTip
                step={tutorial.step}
                mode={preview.mode}
                onSkip={tutorial.skip}
                onKeepDefaults={tutorial.applyFilter}
              />
            )}
            {preview.showCommute && (
              <div className={styles.filterChips} aria-label="탐색 조건">
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
                  <span>{preview.maxTransfers === 0 ? '환승 없음' : `환승 ${preview.maxTransfers}회 이하`}</span>
                  <Icon name="chevron-down" size={16} />
                </Button>
              </div>
            )}
            {preview.showPrice && (
              <div className={styles.filterChips} aria-label="가격 조건">
                <Button
                  variant="secondary"
                  onClick={() => setFilterField('rent')}
                  aria-expanded={filterField === 'rent'}
                >
                  <span>{preview.maxRent === 0 ? '월세 평균가 전체' : `${preview.maxRent}만원 이하`}</span>
                  <Icon name="chevron-down" size={16} />
                </Button>
              </div>
            )}
          </header>
          {locationControls}
          <Toast
            className={styles.entryToast}
            title={preview.showPrice ? '어느 동네의 월세가 궁금하세요?' : '어디로 출퇴근·통학하세요?'}
            description={'학교·회사 등 자주 가는 곳을 검색하거나\n지도에서 선택해주세요.'}
            isOpen={!preview.isPublicExplore && isEntryToastOpen && !preview.hasChosenMapPoint && filterField === null}
            onClose={closeEntryToast}
          />
          {filterField !== null && (
            <BottomSheet
              title={filterField === 'minutes' ? '통근 시간' : filterField === 'rent' ? '월세 평균가' : '환승 횟수'}
              initialHeightPercent={filterField !== 'transfers' ? 55 : 32}
              resizable={false}
              onClose={() => setFilterField(null)}
            >
              <NeighborhoodFilters
                key={filterField}
                preview={preview}
                field={filterField}
                onClose={() => setFilterField(null)}
                onApply={tutorial.applyFilter}
              />
            </BottomSheet>
          )}
        </section>
      ) : (
        <section className={styles.mapPage} aria-label="행정동 프리셋 지도">
          <MapCanvas
            animateView
            coordinateAction={
              preview.selected
                ? {
                    ...preview.selected.center,
                    placement: 'above',
                    label: `${preview.selected.name} · 약 ${preview.selected.commuteMinutes}분\n대중교통 정보 보기 →`,
                    onClick: preview.openAreaDetails,
                  }
                : undefined
            }
            customStyleId={NEIGHBORHOOD_MAP_STYLE_ID}
            center={preview.center}
            level={preview.resultLevel}
            interactive
            markers={destinationMarkers}
            onCenterChange={preview.rememberResultCenter}
            onLevelChange={preview.rememberResultLevel}
            regions={preview.regions}
            selectedRegionId={preview.selectedPrice?.legalDongCode ?? preview.selected?.adminDongCode}
            onSelectRegion={preview.selectRegion}
          />
          <header className={styles.resultHeader}>
            <Button variant="secondary" className={styles.resultBack} onClick={preview.reset}>
              <Icon name="refresh" size={26} />
              다시 선택하기
            </Button>
            <div className={styles.resultCriteria}>
              <div className={styles.criteriaBadges} aria-label="선택한 탐색 조건">
                {preview.showPrice ? (
                  <>
                    <Button variant="secondary" className={styles.filterBadge} onClick={() => setFilterField('rent')}>
                      {preview.maxRent === 0 ? '월세 평균가 전체' : `${preview.maxRent}만원 이하`}{' '}
                      <Icon name="chevron-down" size={16} />
                    </Button>
                    <span>주변 3km · 최대 5개 법정동</span>
                    <span>최근 6개월 · 5~10평 · 관리비 제외{preview.isMockData ? ' · 테스트 데이터' : ''}</span>
                  </>
                ) : (
                  <>
                    <span>통근 {preview.maxMinutes}분 이내</span>
                    <span>{preview.maxTransfers === 0 ? '환승 없음' : `환승 ${preview.maxTransfers}회 이하`}</span>
                  </>
                )}
              </div>
              {preview.showCommute && (
                <div className={styles.colorLegend} aria-label="통근 시간 색상 기준">
                  {commuteLegend(preview.maxMinutes).map(([group, label]) => (
                    <span key={group}>
                      <i style={{ background: COMMUTE_COLORS[group].fillColor }} />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </header>
          {locationControls}
          {preview.isPublicExplore && recordArea && (
            <div className={styles.recordAction}>
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
            <div className={styles.resultControls}>
              <p className={styles.selectedInfo}>
                {preview.mode === 'commute'
                  ? '조건에 맞는 동네가 없어요.'
                  : '현재 경계 파일 범위에서 주변 법정동을 찾지 못했어요. 서울·경기 위치를 선택해주세요.'}
              </p>
            </div>
          )}
          {!isRoutePage && preview.showCommute && preview.topAreas.length > 0 && (
            <div className={styles.topAreaRail} aria-label="통근 시간 상위 동네">
              <HorizontalRail className={styles.areaCards}>
                {preview.topAreas.map((area, index) => (
                  <RankedCard
                    key={area.adminDongCode}
                    className={styles.areaCard}
                    rank={CARD_RANKS[index]}
                    title={area.name}
                    value={area.commuteMinutes}
                    unit="분"
                    description={`${area.stations[0].stopName}에서 출발`}
                    selected={preview.selected?.adminDongCode === area.adminDongCode}
                    onSelect={() => preview.selectRegion(area.adminDongCode)}
                  />
                ))}
              </HorizontalRail>
            </div>
          )}
          {isRoutePage && <Outlet context={preview} />}
          {preview.showPrice && preview.priceAreas.length > 0 && (
            <div className={styles.topAreaRail} aria-label="주변 월세 평균가">
              <HorizontalRail className={styles.areaCards}>
                {preview.priceAreas.map((area, index) => (
                  <RankedCard
                    key={area.legalDongCode}
                    className={styles.areaCard}
                    rank={CARD_RANKS[index]}
                    title={area.name}
                    value={area.average === null ? '—' : Math.round(area.average / 10000)}
                    unit={area.average === null ? '' : '만원'}
                    description={area.average === null ? '거래 정보 없음' : `월세 평균 · ${area.items.length}건`}
                    onSelect={() => preview.selectRegion(area.legalDongCode)}
                  />
                ))}
              </HorizontalRail>
            </div>
          )}
          {preview.showPrice && preview.priceAreas.length === 0 && (
            <p className={styles.emptyResult} role="status">
              조건에 맞는 동네가 없어요. 가격 조건을 넓혀보세요.
            </p>
          )}
          {preview.showPrice && filterField === 'rent' && (
            <BottomSheet
              title="월세 평균가"
              initialHeightPercent={55}
              resizable={false}
              onClose={() => setFilterField(null)}
            >
              <NeighborhoodFilters preview={preview} field="rent" onClose={() => setFilterField(null)} />
            </BottomSheet>
          )}
        </section>
      )}
    </main>
  );
};
export default NeighborhoodPreviewPage;
