import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import type { MapRegion } from '../model/MapCanvas';
import type { AdminBoundaries } from './adminBoundaryApi';
import { fetchBoundaryManifest, selectBoundaryFiles } from './adminBoundaryApi';
import { getAdminBoundaryQueryOptions } from './adminBoundaryQueries';

const EMPTY: MapRegion[] = [];

// 경계를 굵은 실선으로 또렷하게 긋고 안쪽은 옅게 칠한다. 안쪽을 진하게 칠하면 지도 글자와 길이 뿌옇게 가려져
// 찜한 동네가 오히려 뒤로 물러나 보인다.
const BOOKMARK_APPEARANCE = { fillColor: '#2f6fe0', strokeColor: '#2554b8', fillOpacity: 0.2 } as const;

/** 찜한 동네 이름표(알약) 높이의 절반(px). 이름표를 누르면 뜨는 카드의 꼬리가 이름표 위쪽에 닿게 한다. */
export const BOOKMARK_LABEL_HALF_HEIGHT = 17;

/**
 * 북마크한 행정동 코드의 경계를 지도에 칠할 구역으로 바꾼다. 켜 둘 때만 경계 파일을 받는다.
 * 경계 파일에서 찾지 못한 코드(다시 적재해 사라진 동네)는 그리지 않는다.
 */
export const useBookmarkedRegions = (codes: string[], enabled: boolean): MapRegion[] => {
  const config = usePublicConfig();
  const client = useQueryClient();
  const key = codes.join(',');
  // codes는 렌더마다 새 배열일 수 있어, 문자열 키로 바뀔 때만 새 목록을 만든다.
  const list = useMemo(() => (key === '' ? [] : key.split(',')), [key]);
  const boundaries = useQuery({
    queryKey: ['bookmarked-regions', config.boundaryBaseUrl, key],
    enabled: enabled && codes.length > 0,
    staleTime: Infinity,
    retry: false,
    // 찜한 동네가 바뀌어 새 경계를 받는 동안에도 이미 받은 경계로 그대로 그린다(키가 바뀌며 지도의 영역이 모두 사라졌다 돌아오지 않게).
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<AdminBoundaries> => {
      const manifest = await fetchBoundaryManifest(config.boundaryBaseUrl, signal);
      const chunks = await Promise.all(
        selectBoundaryFiles(manifest, codes).map((file) =>
          client.ensureQueryData(getAdminBoundaryQueryOptions(file, config.boundaryBaseUrl)),
        ),
      );
      return chunks.reduce<AdminBoundaries>((all, chunk) => Object.assign(all, chunk), {});
    },
  });
  const all = boundaries.data;
  return useMemo(
    () =>
      !enabled || all === undefined
        ? EMPTY
        : list.flatMap((code) => {
            const boundary = all[code];
            return boundary === undefined
              ? []
              : [
                  {
                    id: code,
                    name: boundary.name,
                    center: boundary.center,
                    paths: [],
                    polygons: boundary.polygons,
                    simplifiedPolygons: boundary.simplifiedPolygons,
                    appearance: BOOKMARK_APPEARANCE,
                    showsName: true,
                  },
                ];
          }),
    [enabled, all, list],
  );
};
