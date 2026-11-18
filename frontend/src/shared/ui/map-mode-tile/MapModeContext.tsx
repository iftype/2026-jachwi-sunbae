import { createContext, useContext } from 'react';

import MapModeTile from './MapModeTile';

/** 통합 지도에서 이 화면이 넘어갈 다른 지도 모드와, 넘어가는 방법. 통합 지도 밖(공개 동네 찾기 등)에서는 없다. */
export type MapModeSwitch = { target: 'records' | 'neighborhoods'; onSwitch: () => void };

const MapModeContext = createContext<MapModeSwitch | null>(null);

export const MapModeProvider = MapModeContext.Provider;

/** 휴대폰 지도 헤더 왼쪽의 모드 전환 타일. 통합 지도 밖이면 아무것도 그리지 않는다. */
export const MapModeSwitchTile = () => {
  const mode = useContext(MapModeContext);
  return mode ? <MapModeTile mode={mode.target} onClick={mode.onSwitch} /> : null;
};

export const useHasMapModeSwitch = () => useContext(MapModeContext) !== null;
