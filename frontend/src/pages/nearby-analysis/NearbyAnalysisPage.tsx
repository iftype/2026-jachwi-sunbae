import { useParams } from 'react-router-dom';

import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCategoryRail from '@/features/map/ui/map-category-rail/MapCategoryRail';
import MapRadiusSelector from '@/features/map/ui/map-radius-selector/MapRadiusSelector';
import { usePropertyDetail } from '@/features/property/api/useProperties';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import { ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import useNearbyAnalysis, {
  NEARBY_RADII,
  type NearbyRadius,
  nearbyRadiusLabel,
  type NearbyRadiusOption,
} from './hooks/useNearbyAnalysis';
import MapNearbySheet from './ui/map-nearby-sheet/MapNearbySheet';
import MapPlaceDetailCard from './ui/map-place-detail-card/MapPlaceDetailCard';
import NearbyMapNotice from './ui/nearby-map-notice/NearbyMapNotice';

import styles from './NearbyAnalysisPage.module.css';

const EMPTY_COUNTS = { HOSPITAL: 0, TRANSPORT: 0, SCHOOL: 0, CONVENIENCE: 0, AGENCY: 0 };

const radiusOptions = (isAllMode: boolean, radius: NearbyRadius) => [
  { value: 'all' as const, label: '전체', isSelected: isAllMode },
  ...NEARBY_RADII.map((value) => ({
    value,
    label: nearbyRadiusLabel(value),
    isSelected: !isAllMode && radius === value,
  })),
];

const NearbyAnalysisPage = () => {
  const propertyId = parsePositiveId(useParams().propertyId);
  if (propertyId === null)
    return <EmptyState title="올바른 매물 주소가 아니에요" description="매물 목록에서 다시 선택해 주세요." />;
  return <ResolvedNearbyAnalysisPage propertyId={propertyId} />;
};

const ResolvedNearbyAnalysisPage = ({ propertyId }: { propertyId: number }) => {
  const property = usePropertyDetail(propertyId);
  const latitude = property.data?.location.latitude ?? null;
  const longitude = property.data?.location.longitude ?? null;
  const hasLocation = latitude !== null && longitude !== null;
  const analysis = useNearbyAnalysis(propertyId, hasLocation ? { latitude, longitude } : null);
  const { nearby } = analysis;

  return (
    <main className={styles.page}>
      <TopNavigation
        className={styles.mapNavigation}
        title="매물 주변 분석"
        backTo="/map"
        backLabel="매물 지도로 돌아가기"
      />
      {property.isError ? (
        <div className={styles.fullState}>
          <InlineNotice tone="error">매물 위치를 불러오지 못했어요.</InlineNotice>
          <button type="button" onClick={() => void property.refetch()}>
            다시 시도
          </button>
        </div>
      ) : !property.isPending && !hasLocation ? (
        <div className={styles.fullState}>
          <EmptyState
            title="먼저 매물 위치를 등록해 주세요"
            description="위치를 저장하면 반경별 주변 시설을 분석할 수 있어요."
            action={<ButtonLink to={`/properties/${propertyId}/edit`}>위치 등록하기</ButtonLink>}
          />
        </div>
      ) : (
        <section className={styles.mapStage} aria-label="매물 주변 분석 지도">
          <MapCanvas
            center={analysis.viewportCenter}
            markers={analysis.markers}
            circles={analysis.circles}
            radiusCenter={analysis.center}
            level={analysis.mapLevel}
            showRadiusLabels
            selectedMarkerId={
              analysis.selectedPlace === null ? null : `place-${analysis.selectedPlace.providerPlaceId}`
            }
            onSelectMarker={analysis.selectMarker}
            onCenterChange={analysis.panTo}
            onLevelChange={analysis.setMapLevel}
          />
          <MapRadiusSelector<NearbyRadiusOption>
            label="분석 반경"
            options={radiusOptions(analysis.isAllMode, analysis.radius)}
            onSelect={analysis.selectRadius}
          />
          <MapCategoryRail
            selectedCategories={analysis.selectedCategories}
            counts={nearby.isSuccess ? nearby.data.counts : undefined}
            onToggle={analysis.selectCategory}
          />
          <NearbyMapNotice
            isPropertyPending={property.isPending}
            isNearbyPending={nearby.isPending}
            isNearbyError={nearby.isError}
            onRetry={() => void nearby.refetch()}
          />
          {analysis.selectedPlace !== null && (
            <MapPlaceDetailCard place={analysis.selectedPlace} onClose={analysis.closePlace} />
          )}
          {!property.isPending && !nearby.isPending && !nearby.isError && (
            <MapNearbySheet
              heading={`${property.data?.name ?? '선택한'} 매물 주변 ${nearbyRadiusLabel(analysis.radius)}`}
              counts={nearby.data?.counts ?? EMPTY_COUNTS}
              selectedCategories={analysis.selectedCategories}
              places={analysis.places}
              expanded={analysis.isListExpanded}
              onToggleExpanded={analysis.toggleList}
              onToggleCategory={analysis.selectCategory}
            />
          )}
        </section>
      )}
    </main>
  );
};

export default NearbyAnalysisPage;
