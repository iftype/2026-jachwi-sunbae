import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import type { MapCategory } from '@/features/map/model/Map';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCategoryRail from '@/features/map/ui/map-category-rail/MapCategoryRail';
import MapRadiusSelector from '@/features/map/ui/map-radius-selector/MapRadiusSelector';

import useNearbyAnalysis, {
  NEARBY_RADII,
  type NearbyRadius,
  nearbyRadiusLabel,
  type NearbyRadiusOption,
} from '../../hooks/useNearbyAnalysis';
import MapNearbySheet from '../map-nearby-sheet/MapNearbySheet';
import MapPlaceDetailCard from '../map-place-detail-card/MapPlaceDetailCard';
import NearbyMapNotice from '../nearby-map-notice/NearbyMapNotice';

import styles from './NearbyStage.module.css';

const EMPTY_COUNTS = { HOSPITAL: 0, TRANSPORT: 0, SCHOOL: 0, CONVENIENCE: 0, AGENCY: 0 };

const radiusOptions = (isAllMode: boolean, radius: NearbyRadius) => [
  { value: 'all' as const, label: '전체', isSelected: isAllMode },
  ...NEARBY_RADII.map((value) => ({
    value,
    label: nearbyRadiusLabel(value),
    isSelected: !isAllMode && radius === value,
  })),
];

type NearbyStageProps = {
  subjectId: number | string;
  center: MapCoordinate | null;
  /** 중심 마커 이름. 매물이면 `선택한 매물`, 동네면 동네 이름. */
  markerLabel?: string;
  initialCategories?: MapCategory[];
  /** 시트 제목 앞부분. `{prefix} 주변 2km`로 보여준다. */
  headingPrefix: string;
  label: string;
  isSubjectPending: boolean;
};

/** 중심 좌표 하나를 기준으로 반경별 주변 시설 지도를 그린다. 매물·동네 화면이 함께 쓴다. */
const NearbyStage = ({
  subjectId,
  center,
  markerLabel,
  initialCategories,
  headingPrefix,
  label,
  isSubjectPending,
}: NearbyStageProps) => {
  const analysis = useNearbyAnalysis(subjectId, center, { markerLabel, initialCategories });
  const { nearby } = analysis;
  return (
    <section className={styles.mapStage} aria-label={label}>
      <MapCanvas
        center={analysis.viewportCenter}
        markers={analysis.markers}
        circles={analysis.circles}
        radiusCenter={analysis.center}
        level={analysis.mapLevel}
        showRadiusLabels
        selectedMarkerId={analysis.selectedPlace === null ? null : `place-${analysis.selectedPlace.providerPlaceId}`}
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
        isPropertyPending={isSubjectPending}
        isNearbyPending={nearby.isPending}
        isNearbyError={nearby.isError}
        onRetry={() => void nearby.refetch()}
      />
      {analysis.selectedPlace !== null && (
        <MapPlaceDetailCard place={analysis.selectedPlace} onClose={analysis.closePlace} />
      )}
      {!isSubjectPending && !nearby.isPending && !nearby.isError && (
        <MapNearbySheet
          heading={`${headingPrefix} 주변 ${nearbyRadiusLabel(analysis.radius)}`}
          counts={nearby.data?.counts ?? EMPTY_COUNTS}
          selectedCategories={analysis.selectedCategories}
          places={analysis.places}
          expanded={analysis.isListExpanded}
          onToggleExpanded={analysis.toggleList}
          onToggleCategory={analysis.selectCategory}
        />
      )}
    </section>
  );
};

export default NearbyStage;
