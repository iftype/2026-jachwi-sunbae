import { useMemo } from 'react';

import type { MapMarker } from '@/features/map/model/Map';
import { PROPERTY_PLACEHOLDER } from '@/shared/assets/propertyImageAssets';

import usePropertyMarkerPhotos from './usePropertyMarkerPhotos';

/** 지도 마커로 그릴 기록 매물의 최소 정보. `rent`는 마커 카드에 쓰는 짧은 월세다. */
type PhotoMarkerRecord = {
  id: string;
  name: string;
  rent: string;
  latitude: number | null;
  longitude: number | null;
  representativePhoto: { photoId: number; contentUrl: string; thumbnailUrl: string } | null;
};

/**
 * 기록 매물을 사진 카드와 월세가 든 지도 마커로 바꾼다. 내 기록, 동네 찾기, 저렴한 한 끼 지도가 같은 모양을 쓰도록 함께 쓴다.
 * 위치가 없는 매물은 뺀다. 대표 사진이 없거나 아직 받지 못했으면 기본 매물 이미지를 올린다.
 * 마커 id는 매물 id 그대로이므로, 다른 마커와 섞는 화면은 호출한 쪽에서 접두사를 붙인다.
 * `appearId`의 매물은 처음 그릴 때 아래에서 떠오른다.
 */
const usePropertyPhotoMarkers = (
  records: readonly PhotoMarkerRecord[],
  appearId: string | null = null,
): MapMarker[] => {
  const photoUrls = usePropertyMarkerPhotos(records);
  return useMemo<MapMarker[]>(
    () =>
      records.flatMap((record) =>
        record.latitude !== null && record.longitude !== null
          ? [
              {
                id: record.id,
                latitude: record.latitude,
                longitude: record.longitude,
                label: record.name,
                summary: { amount: record.rent },
                tone: 'property',
                actionable: true,
                appear: record.id === appearId || undefined,
                photo: photoUrls.get(record.id) ?? PROPERTY_PLACEHOLDER.src2x,
              },
            ]
          : [],
      ),
    [records, appearId, photoUrls],
  );
};

export default usePropertyPhotoMarkers;
