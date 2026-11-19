import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import type { FacilityCategory } from '../lib/mapPresentation';

type FacilityFocus = { category: FacilityCategory | null; setCategory: (category: FacilityCategory | null) => void };

const FacilityFocusContext = createContext<FacilityFocus | null>(null);

/**
 * 지도 분류 막대와 주변 시설 요약이 함께 쓰는 선택된 시설 분류.
 * 한쪽에서 고르거나 해제하면 다른 쪽에도 반영되고, 화면을 오가도 지도 화면이 떠 있는 동안 유지된다.
 */
export const FacilityFocusProvider = ({ children }: { children: ReactNode }) => {
  const [category, setCategory] = useState<FacilityCategory | null>(null);
  const value = useMemo(() => ({ category, setCategory }), [category]);
  return <FacilityFocusContext.Provider value={value}>{children}</FacilityFocusContext.Provider>;
};

/** 공유 제공자가 없는 화면(휴대폰 매물 상세, 단독 사용)에서는 그 컴포넌트 안에서만 쓰는 상태로 되돌아간다. */
const useFacilityFocus = (): [FacilityCategory | null, (category: FacilityCategory | null) => void] => {
  const shared = useContext(FacilityFocusContext);
  const [local, setLocal] = useState<FacilityCategory | null>(null);
  return shared ? [shared.category, shared.setCategory] : [local, setLocal];
};

export default useFacilityFocus;
