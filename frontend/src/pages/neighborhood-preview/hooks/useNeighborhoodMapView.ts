import { useMemo } from 'react';

import { formatManwon } from '@/features/map/api/commuteApi';
import type { MapCanvasProps, MapRegion } from '@/features/map/model/MapCanvas';

import useNeighborhoodPlaces from './useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from './useNeighborhoodPreview';

const NO_REGIONS: MapRegion[] = [];

/**
 * 휴대폰·데스크탑 동네 찾기가 함께 쓰는 지도 설정. 위치 선택·분석·결과 내내 지도 하나를 유지하고 단계마다 넘기는 값만 바꾼다.
 * 단계마다 지도를 새로 만들면 GL 지도가 스타일·타일을 처음부터 다시 준비한다.
 */
type MapViewOptions = {
  /** 휴대폰은 고른 동네 위에 '대중교통 정보 보기' 말풍선을 띄운다. 데스크탑은 동네 정보를 왼쪽 목록에 펼치므로 띄우지 않는다. */
  showAreaAction?: boolean;
};

const useNeighborhoodMapView = (
  preview: NeighborhoodPreviewContext,
  { showAreaAction = true }: MapViewOptions = {},
) => {
  const isResultMap = !preview.isAnalyzing && !preview.error && !preview.isSelectingOnMap;
  const places = useNeighborhoodPlaces(isResultMap, preview.selected !== undefined);
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
      ...places.markers,
      { ...preview.destination, id: 'destination', label: preview.destination.name, tone: 'destination' as const },
    ],
    [preview.destination, currentMarkers, places.markers],
  );
  const candidateMarkers = useMemo(
    () => [
      ...currentMarkers,
      ...(preview.hasChosenMapPoint
        ? [{ ...preview.mapCandidate, id: 'candidate', label: preview.mapCandidate.name, tone: 'destination' as const }]
        : []),
    ],
    [preview.mapCandidate, preview.hasChosenMapPoint, currentMarkers],
  );
  const mapProps: Pick<MapCanvasProps, 'center'> & Partial<MapCanvasProps> = isResultMap
    ? {
        center: preview.center,
        level: preview.resultLevel,
        markers: destinationMarkers,
        onCenterChange: preview.rememberResultCenter,
        onLevelChange: (level: number) => {
          preview.rememberResultLevel(level);
          places.rememberLevel(level);
        },
        onBoundsChange: places.rememberBounds,
        selectedMarkerId: places.selectedMarkerId,
        onSelectMarker: places.selectMarker,
        regions: preview.regions,
        selectedRegionId: preview.selected?.adminDongCode,
        // 동네를 고르면 열어 둔 정류장·부동산 정보는 닫는다.
        onSelectRegion: (id: string) => {
          places.closePlace();
          // 데스크탑은 동네를 고를 때 대중교통 상세를 열지 않는다(왼쪽 목록에 요약을 펼친다).
          preview.selectRegion(id, showAreaAction ? undefined : { openDetails: false });
        },
        coordinateAction:
          // 정류장·부동산 정보를 띄우는 동안은 동네 말풍선을 숨겨 마커와 시트를 가리지 않게 한다.
          showAreaAction && preview.selected && !places.selectedPlace
            ? {
                ...preview.selected.center,
                placement: 'above' as const,
                label: `${preview.selected.name} · 약 ${preview.selected.commuteMinutes}분${preview.selected.rent ? ` · 월세 ${formatManwon(preview.selected.rent.monthlyRentKrw)}` : ''}\n대중교통 정보 보기 →`,
                onClick: preview.openAreaDetails,
              }
            : undefined,
      }
    : {
        center: preview.selectionCenter,
        level: preview.selectionLevel,
        markers: candidateMarkers,
        regions: NO_REGIONS,
        // 분석 중이거나 실패 화면이 지도를 덮고 있을 때는 위치 찍기를 끈다.
        // 찾기 버튼은 지도 위에 두면 고른 장소 말풍선 핀과 겹쳐, 휴대폰은 아래 카드·데스크탑은 왼쪽 칸에 둔다.
        onSelectLocation: preview.isSelectingOnMap ? preview.chooseMapPoint : undefined,
      };
  return { isResultMap, mapProps, places };
};

export default useNeighborhoodMapView;
