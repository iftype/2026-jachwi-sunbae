import { createContext, type ReactNode, useContext } from 'react';

type PanelDetail = { content: ReactNode; close: () => void; closeLabel: string };
/** 지도 위 왼쪽 칸을 대신 채우는 화면. `detail`을 주면 데스크탑은 그 칸 옆 상세 칸에 연다. */
type Panel = { content: ReactNode; close: () => void; detail?: PanelDetail } | null;
const MapPanelContext = createContext<Panel>(null);
export const MapPanelProvider = MapPanelContext.Provider;
export const useMapPanel = () => useContext(MapPanelContext);
