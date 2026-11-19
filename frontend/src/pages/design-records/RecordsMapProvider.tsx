import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { centerWithInsets } from '@/features/map/lib/mapCamera';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import type { MapAddress } from '@/features/map/model/Map';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import {
  NEIGHBORHOODS_PATH,
  PROPERTIES_PATH,
  propertyDetailPath,
  RECORDS_MAP_PATH,
  RECORDS_PATH,
} from '@/shared/lib/navigation/appPaths';
import { isDetailCollapsed } from '@/shared/ui/list-detail-layout/detailCollapse';

import useQuickCreateProperty from './hooks/useQuickCreateProperty';
import type { RecordsState } from './hooks/useRecords';
import useRecords from './hooks/useRecords';
import type { RecordsMapLayers } from './hooks/useRecordsMapLayers';
import useRecordsMapLayers from './hooks/useRecordsMapLayers';

type RecordsMapController = {
  records: RecordsState;
  layers: RecordsMapLayers;
  setInteractionLevel: (level: number) => void;
  /** 패널에 가리지 않는 남은 지도 영역의 가운데에 좌표가 오도록 옮긴 지도 중심. */
  centerBesidePanels: (point: MapCoordinate, level: number, opensDetail: boolean) => MapCoordinate;
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
  /**
   * 목록과 상세 패널에 가린 폭을 뺀 남은 지도 영역의 가운데에 좌표가 오도록 지도 중심을 옮긴다. 내 기록과 동네 찾기가 함께 쓴다.
   * 화면에 보이는 패널 틀만 재므로, 숨겨 둔 다른 화면의 틀은 건너뛴다.
   */
  const centerBesidePanels = (point: MapCoordinate, level: number, opensDetail: boolean): MapCoordinate => {
    const layout = Array.from(pageRef.current?.querySelectorAll('[data-floating="true"]') ?? []).find(
      (element) => element.getBoundingClientRect().width > 0,
    );
    const rect = layout?.getBoundingClientRect();
    const list = layout?.firstElementChild?.getBoundingClientRect();
    if (!isDesktop || !rect?.width || !list) return point;
    // 이미 열린 상세는 그 폭을 재고, 이번에 열릴 상세는 `ListDetailLayout`의 상세 폭(clamp(22rem, 28%, 26rem))을 미리 뺀다.
    // 상세를 접어 두었으면 열리지 않으므로 빼지 않는다.
    const openDetail = layout?.querySelector('[data-list-detail-detail]')?.getBoundingClientRect();
    const detailWidth = isDetailCollapsed()
      ? 0
      : openDetail?.width || (opensDetail ? Math.max(352, Math.min(416, rect.width * 0.28)) : 0);
    return centerWithInsets(point, level, {
      left: list.right - rect.left + detailWidth + 24,
      right: 80,
      top: 100,
      bottom: 60,
    });
  };
  const records = useRecords({
    selectedId: lastPropertyId,
    focusCenter: centerBesidePanels,
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
    <Context.Provider value={{ records, layers, setInteractionLevel, centerBesidePanels }}>
      <div ref={pageRef} style={{ height: '100%' }}>
        {children}
      </div>
    </Context.Provider>
  );
};
