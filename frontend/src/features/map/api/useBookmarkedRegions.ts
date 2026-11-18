import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import type { MapRegion } from '../model/MapCanvas';
import type { AdminBoundaries } from './adminBoundaryApi';
import { fetchBoundaryManifest, selectBoundaryFiles } from './adminBoundaryApi';
import { getAdminBoundaryQueryOptions } from './adminBoundaryQueries';

const EMPTY: MapRegion[] = [];

/**
 * 찜한 동네를 칠하는 색. 우리 primary 파랑 계열의 옅은 채움(투명도 0.18)과 진한 윤곽선이다.
 * 동네 찾기의 통근 색(초록, 노랑, 빨강)이나 월세 정보 없음 회색 위에서도 구분되게 윤곽선은 점선으로 둔다.
 */
const BOOKMARK_APPEARANCE = { fillColor: '#3f6fc42e', strokeColor: '#2f56a0', dashed: true } as const;

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
