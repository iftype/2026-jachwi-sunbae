import { useMemo } from 'react';
import { Outlet, useMatch } from 'react-router-dom';

import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCurrentLocationButton from '@/features/map/ui/map-current-location-button/MapCurrentLocationButton';
import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import RankedCard from '@/shared/ui/ranked-card/RankedCard';
import SearchField from '@/shared/ui/search-field/SearchField';

import useHorizontalDrag from './hooks/useHorizontalDrag';
import useNeighborhoodPreview from './hooks/useNeighborhoodPreview';
import { COMMUTE_COLORS } from './model/commuteColors';
import { PREVIEW_DESTINATION } from './model/preview';

import styles from './NeighborhoodPreviewPage.module.css';

const CARD_RANKS = [1, 2, 3, 4, 5] as const;

const NeighborhoodPreviewPage = () => {
  const preview = useNeighborhoodPreview();
  const cardDrag = useHorizontalDrag();
  const isRoutePage = useMatch('/neighborhoods/map/areas/:adminDongCode');
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
      ...(preview.selected?.stations ?? []).map((station) => ({
        latitude: station.latitude,
        longitude: station.longitude,
        id: station.stopId,
        label: `${station.stopName}${station.direction ? ` (${station.direction})` : ''} · ${station.travelMinutes}분`,
      })),
    ],
    [preview.destination, preview.selected, currentMarkers],
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
    <div className={styles.locationControls} data-result={!preview.isSelectingOnMap || undefined}>
      {(preview.isLocating || preview.locationError) && (
        <span className={styles.locationStatus} role={preview.locationError ? 'alert' : 'status'}>
          {preview.isLocating ? '현재 위치를 확인하는 중이에요.' : preview.locationError}
        </span>
      )}
      <MapCurrentLocationButton isLocating={preview.isLocating} onClick={preview.moveToCurrentLocation} />
    </div>
  );
  if (isRoutePage && !preview.selected) return <Outlet context={preview} />;
  return (
    <main className={styles.page}>
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
            center={preview.selectionCenter}
            level={preview.selectionLevel}
            interactive
            markers={candidateMarkers}
            onSelectLocation={preview.chooseMapPoint}
          />
          <header className={styles.searchHeader}>
            <div className={styles.mapSearch}>
              <SearchField
                className={styles.activeSearchField}
                shape="pill"
                showSubmitButton={false}
                label={preview.mode === 'commute' ? '출퇴근 장소' : '관심 지역'}
                placeholder={preview.mode === 'commute' ? '출퇴근하는 장소 검색' : '관심 지역 검색'}
                value={preview.query}
                onValueChange={preview.changeQuery}
                onSubmit={preview.searchDestination}
                onBack={preview.reset}
                autoFocus={preview.shouldFocusMapSearch}
              />
            </div>
            {preview.query.trim() !== '' && !preview.hasChosenMapPoint && (
              <button
                className={styles.mapSearchResult}
                onClick={preview.searchDestination}
                disabled={!preview.matchesDestination}
              >
                {preview.matchesDestination ? PREVIEW_DESTINATION.name : '시안에서는 판교사옥을 검색할 수 있어요.'}
              </button>
            )}
            {(preview.showCommute || preview.isChoosingConditions) && (
              <div>
                <div className={styles.filters} aria-label="탐색 조건">
                  {preview.showCommute && (
                    <>
                      <label className={styles.minuteBadge}>
                        통근
                        <input
                          type="number"
                          min={5}
                          max={180}
                          step={5}
                          inputMode="numeric"
                          aria-label="최대 통근 시간"
                          value={Number.isFinite(preview.maxMinutes) ? preview.maxMinutes : ''}
                          onChange={(event) => preview.changeMaxMinutes(event.target.valueAsNumber)}
                          aria-invalid={!preview.isValidCommuteTime}
                        />
                        분 이내
                      </label>
                      <label>
                        <select
                          aria-label="최대 환승 횟수"
                          value={preview.maxTransfers}
                          onChange={(event) => preview.changeMaxTransfers(Number(event.target.value))}
                        >
                          {[0, 1, 2].map((count) => (
                            <option key={count} value={count}>
                              {count === 0 ? '환승 없음' : `환승 ${count}회 이하`}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
                {preview.showCommute && !preview.isValidCommuteTime && (
                  <small className={styles.priceNote} role="alert">
                    통근 시간은 5~180분 사이에서 5분 단위로 입력해주세요.
                  </small>
                )}
                {preview.showPrice && (
                  <small className={styles.priceNote}>주변 3km · 최대 5개 법정동 · 최근 6개월 · 5~10평</small>
                )}
              </div>
            )}
          </header>
          {locationControls}
          {!preview.hasChosenMapPoint && (
            <aside className={styles.entryGuide} aria-label="동네 찾기 시작 안내">
              <strong>{preview.showPrice ? '어느 동네의 월세가 궁금하세요?' : '어디로 출퇴근·통학하세요?'}</strong>
              <p>
                학교·회사 등 자주 가는 곳을 검색하거나
                <br />
                지도에서 선택해주세요.
              </p>
              <small>
                {preview.showCommute
                  ? '통근 시간·환승 조건으로 주변 동네를 찾아봐요.'
                  : '주변 동네의 월세 거래 정보를 살펴봐요.'}
              </small>
            </aside>
          )}
          {preview.hasChosenMapPoint && (
            <div className={styles.bottom}>
              <p>{preview.mapCandidate.name}</p>
              <Button
                variant="soft"
                fullWidth
                className={styles.confirmPoint}
                disabled={!preview.hasChosenMapPoint || (preview.showCommute && !preview.isValidCommuteTime)}
                onClick={preview.isChoosingConditions ? preview.startAnalysis : preview.confirmMapPoint}
              >
                {preview.isChoosingConditions ? '선택한 조건으로 찾기' : '이 위치로 선택'}
              </Button>
              <Button variant="secondary" fullWidth className={styles.confirmPoint} onClick={preview.openModeSelection}>
                <Icon name="arrow-left" size={18} />
                탐색 기준 바꾸기
              </Button>
            </div>
          )}
        </section>
      ) : (
        <section className={styles.mapPage} aria-label="행정동 프리셋 지도">
          <MapCanvas
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
                  {(
                    [
                      ['fast', `${Math.floor(preview.maxMinutes / 3)}분 이하`],
                      [
                        'medium',
                        `${Math.floor(preview.maxMinutes / 3) + 1}~${Math.floor((preview.maxMinutes * 2) / 3)}분`,
                      ],
                      ['slow', `${Math.floor((preview.maxMinutes * 2) / 3) + 1}~${preview.maxMinutes}분`],
                    ] as const
                  ).map(([group, label]) => (
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
              <div className={styles.areaCards} {...cardDrag}>
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
              </div>
            </div>
          )}
          {isRoutePage && <Outlet context={preview} />}
          {preview.showPrice && !preview.selectedPrice && preview.priceAreas.length > 0 && (
            <div className={styles.topAreaRail} aria-label="주변 월세 평균가">
              <div className={styles.areaCards} {...cardDrag}>
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
              </div>
            </div>
          )}
          {preview.selectedPrice && (
            <BottomSheet title={preview.selectedPrice.name} onClose={preview.closePrice}>
              <p>{preview.selectedPrice.fullName}</p>
              <h2>
                {preview.selectedPrice.average === null
                  ? '거래 정보 없음'
                  : `평균 월세 ${Math.round(preview.selectedPrice.average / 10000)}만원`}
              </h2>
              <p>
                {preview.selectedPrice.period} · {preview.selectedPrice.items.length}건 · 관리비 제외
              </p>
              <p>5~10평 소형 주택의 단순 평균이에요. 보증금 차이를 조정한 가격은 아닙니다.</p>
              <ul>
                {preview.selectedPrice.items.map((item) => (
                  <li key={item.rentalTransactionId}>
                    {item.contractDate} · 보증금 {Math.round(item.depositAmountKrw / 10000).toLocaleString()}만원 / 월세{' '}
                    {Math.round(item.monthlyRentAmountKrw / 10000)}만원 · {item.areaM2}㎡
                  </li>
                ))}
              </ul>
            </BottomSheet>
          )}
        </section>
      )}
    </main>
  );
};
export default NeighborhoodPreviewPage;
