import { createContext, useContext } from 'react';

import { MOBILE_BOTTOM_TABS_ENABLED } from '../bottom-tab-bar/bottomTabConfig';
import MapModeTile from './MapModeTile';

/** 통합 지도에서 이 화면이 넘어갈 다른 지도 모드와, 넘어가는 방법. 통합 지도 밖(공개 동네 찾기 등)에서는 없다. */
export type MapModeSwitch = { target: 'records' | 'neighborhoods'; onSwitch: () => void };

const MapModeContext = createContext<MapModeSwitch | null>(null);

export const MapModeProvider = MapModeContext.Provider;

/** 휴대폰 지도 헤더 왼쪽의 모드 전환 타일. 통합 지도 밖이거나 하단 탭을 쓰면(중복) 아무것도 그리지 않는다. */
export const MapModeSwitchTile = () => {
  const mode = useContext(MapModeContext);
  return mode && !MOBILE_BOTTOM_TABS_ENABLED ? <MapModeTile mode={mode.target} onClick={mode.onSwitch} /> : null;
};

/** 지금 화면에서 다른 지도 모드로 넘어가는 방법. 통합 지도 밖이면 null이다. */
export const useMapModeSwitch = () => useContext(MapModeContext);

export const useHasMapModeSwitch = () => useContext(MapModeContext) !== null;
