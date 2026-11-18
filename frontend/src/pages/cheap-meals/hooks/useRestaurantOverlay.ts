import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { CHEAP_MEALS_SEARCH_PARAM, CHEAP_MEALS_STORE_PARAM } from '@/shared/lib/navigation/appPaths';

type RestaurantOverlayState = { restaurantOverlay?: boolean };

/** 업소 상세는 하나의 이력만 사용해 닫기 한 번으로 목록으로 돌아간다. 예전 주소 검색 주소(`?search=1`)는 열지 않고 지운다. */
const useRestaurantOverlay = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedStoreId = params.get(CHEAP_MEALS_STORE_PARAM);
  const hasOverlay = selectedStoreId !== null;
  const hasOverlayHistory = (location.state as RestaurantOverlayState | null)?.restaurantOverlay === true;

  const createBaseParams = () => {
    const next = new URLSearchParams(params);
    next.delete(CHEAP_MEALS_STORE_PARAM);
    next.delete(CHEAP_MEALS_SEARCH_PARAM);
    return next;
  };
  const openOverlay = (key: typeof CHEAP_MEALS_STORE_PARAM, value: string) => {
    const next = createBaseParams();
    next.set(key, value);
    setParams(next, {
      replace: hasOverlay,
      state: { restaurantOverlay: hasOverlayHistory || !hasOverlay },
    });
  };
  const closeOverlay = () => {
    if (!hasOverlay) return;
    if (hasOverlayHistory) navigate(-1);
    // 직접 진입한 상세 URL은 이전 사이트로 이탈하지 않고 현재 주소의 상세만 닫는다.
    else setParams(createBaseParams(), { replace: true, state: null });
  };

  return {
    selectedStoreId,
    openStore: (id: number) => openOverlay(CHEAP_MEALS_STORE_PARAM, String(id)),
    closeOverlay,
    // 주소의 가게가 지금 동네 목록에 없을 때(다른 동네에서 연 가게 주소 등) 이력을 늘리지 않고 주소에서만 지운다.
    forgetStore: () => {
      const next = new URLSearchParams(params);
      next.delete(CHEAP_MEALS_STORE_PARAM);
      setParams(next, { replace: true, state: location.state as unknown });
    },
  };
};

export default useRestaurantOverlay;
