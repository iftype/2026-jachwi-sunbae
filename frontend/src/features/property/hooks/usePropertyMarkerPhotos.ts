import { useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { fetchPropertyPhotoContent } from '../api/photoApi';
import { fetchPhotoContentOrPreview } from '../api/previewPropertyApi';
import { propertyQueryKeys } from '../api/propertyQueryKeys';

/** 마커 사진이 필요한 매물의 최소 정보. 매물 번호는 숫자나 숫자 문자열이다. */
type PhotoMarkerSource = {
  id: string | number;
  latitude: number | null;
  longitude: number | null;
  representativePhoto: { photoId: number; contentUrl: string; thumbnailUrl: string } | null;
};

/** 마커 사진을 받는 매물 수의 상한. 많은 매물의 사진을 한꺼번에 받지 않게 앞쪽 일부만 쓴다. */
const MAX_PHOTO_MARKERS = 30;

/**
 * 대표 사진이 있는 매물의 지도 마커에 쓸 사진 주소를 돌려준다(매물 번호 → 주소).
 * 사진은 로그인한 요청으로 받아야 해서 받은 내용을 임시 주소로 바꿔 쓰고, 화면을 떠나거나 사진이 바뀌면 주소를 풀어 준다.
 * 아직 받지 못한 매물은 목록에 없고, 그동안 마커는 기본 집 핀으로 그려진다.
 */
const usePropertyMarkerPhotos = (records: readonly PhotoMarkerSource[]): ReadonlyMap<string, string> => {
  const config = usePublicConfig();
  const withPhoto = records
    .filter((record) => record.representativePhoto !== null && record.latitude !== null && record.longitude !== null)
    .slice(0, MAX_PHOTO_MARKERS);
  const results = useQueries({
    queries: withPhoto.map((record) => {
      const photo = record.representativePhoto as NonNullable<PhotoMarkerSource['representativePhoto']>;
      return {
        queryKey: propertyQueryKeys.photoContent(Number(record.id), photo.photoId, 'thumbnail'),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchPhotoContentOrPreview(Number(record.id), photo.thumbnailUrl, () =>
            fetchPropertyPhotoContent(config, photo.thumbnailUrl, signal),
          ),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 0,
      };
    }),
  });
  const blobs = results.map((result) => result.data);
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());

  const signature = withPhoto.map((record, index) => `${record.id}:${blobs[index] === undefined ? 0 : 1}`).join(',');
  useEffect(() => {
    const next = new Map<string, string>();
    withPhoto.forEach((record, index) => {
      const blob = blobs[index];
      if (blob !== undefined) next.set(String(record.id), URL.createObjectURL(blob));
    });
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
    // 어느 매물의 사진이 도착했는지가 바뀔 때만 임시 주소를 다시 만든다.
  }, [signature]);

  return urls;
};

export default usePropertyMarkerPhotos;
