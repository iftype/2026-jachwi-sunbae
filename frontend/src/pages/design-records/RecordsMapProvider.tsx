import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { centerWithInsets } from '@/features/map/lib/mapCamera';
import type { MapAddress } from '@/features/map/model/Map';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import {
  NEIGHBORHOODS_PATH,
  PROPERTIES_PATH,
  propertyDetailPath,
  RECORDS_MAP_PATH,
  RECORDS_PATH,
} from '@/shared/lib/navigation/appPaths';

import useQuickCreateProperty from './hooks/useQuickCreateProperty';
import type { RecordsState } from './hooks/useRecords';
import useRecords from './hooks/useRecords';
import type { RecordsMapLayers } from './hooks/useRecordsMapLayers';
import useRecordsMapLayers from './hooks/useRecordsMapLayers';

type RecordsMapController = {
  records: RecordsState;
  layers: RecordsMapLayers;
  setInteractionLevel: (level: number) => void;
};
const Context = createContext<RecordsMapController | null>(null);
export const useRecordsMapController = () => useContext(Context);
export const RecordsMapProvider = ({ children }: { children: ReactNode }) => {
  const isDesktop = useIsDesktop();
  const pageRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const params = useParams();
  const { pathname } = useLocation();
  const [interactionLevel, setInteractionLevel] = useState<number | undefined>();
  useEffect(() => {
    if (!pathname.startsWith(NEIGHBORHOODS_PATH)) setInteractionLevel(undefined);
  }, [pathname]);
  const [lastPropertyId, setLastPropertyId] = useState<string | null>(params.propertyId ?? null);
  const [lastRecordPath, setLastRecordPath] = useState(pathname);
  if ((pathname === RECORDS_PATH || pathname.startsWith(`${PROPERTIES_PATH}/`)) && pathname !== lastRecordPath) {
    setLastRecordPath(pathname);
    setLastPropertyId(params.propertyId ?? null);
  }
  const records = useRecords({
    selectedId: lastPropertyId,
    focusCenter: (point, level, opensDetail) => {
      const layout = pageRef.current?.querySelector('[data-floating="true"]');
      const rect = layout?.getBoundingClientRect();
      const list = layout?.firstElementChild?.getBoundingClientRect();
      if (!isDesktop || !rect?.width || !list) return point;
      const detailWidth = opensDetail ? Math.max(352, Math.min(416, rect.width * 0.28)) : 0;
      return centerWithInsets(point, level, {
        left: list.right - rect.left + detailWidth + 24,
        right: 80,
        top: 100,
        bottom: 60,
      });
    },
    setSelectedId: (id) => {
      setLastPropertyId(id);
      if (isDesktop && (id !== null || !pathname.startsWith(NEIGHBORHOODS_PATH)))
        navigate(id === null ? RECORDS_PATH : propertyDetailPath(id));
    },
  });
  const [creatingAt, setCreatingAt] = useState<MapAddress | null>(null);
  const quickCreate = useQuickCreateProperty({
    onCreated: (id, location) => {
      setCreatingAt(null);
      records.revealCreated(String(id), location);
      if (!isDesktop && pathname.startsWith(NEIGHBORHOODS_PATH)) {
        setLastRecordPath(RECORDS_PATH);
        navigate(RECORDS_MAP_PATH);
      }
      records.setNotice('매물을 기록했어요. 항목을 눌러 정보를 채워 주세요.');
    },
    onError: () => {
      setCreatingAt(null);
      records.setNotice('매물을 만들지 못했어요. 다시 시도해 주세요.');
    },
  });
  const layers = useRecordsMapLayers(records, {
    registeringAt: creatingAt,
    interactionLevel,
    groupAction: isDesktop ? 'list' : undefined,
    keepSelectionOnMapTap: isDesktop,
    memoLevelBoost: isDesktop ? 1 : 0,
    // 추천받을 자리는 주소를 찾아 검색창에 맞추지 않고, 찍은 좌표 그대로 동네 찾기 조건 칸을 연다.
    onRecommend: (location) => {
      navigate(NEIGHBORHOODS_PATH, { state: { searchedAddress: location, openRecommendationFilters: true } });
    },
    onRegister: (location) => {
      if (quickCreate.isCreating) return;
      setCreatingAt(location);
      quickCreate.create(location);
    },
  });
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        layers.cancelPlacement();
      }
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [layers]);
  return (
    <Context.Provider value={{ records, layers, setInteractionLevel }}>
      <div ref={pageRef} style={{ height: '100%' }}>
        {children}
      </div>
    </Context.Provider>
  );
};
