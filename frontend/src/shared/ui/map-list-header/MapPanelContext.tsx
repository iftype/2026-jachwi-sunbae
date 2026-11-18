import { createContext, type ReactNode, useContext } from 'react';

type Panel = { content: ReactNode; close: () => void } | null;
const MapPanelContext = createContext<Panel>(null);
export const MapPanelProvider = MapPanelContext.Provider;
export const useMapPanel = () => useContext(MapPanelContext);
