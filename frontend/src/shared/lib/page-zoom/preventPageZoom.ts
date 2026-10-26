/** 지도 영역 표시. 이 안의 핀치는 지도 SDK가 직접 확대·축소로 처리한다. */
export const MAP_ZOOM_AREA_ATTRIBUTE = 'data-map-zoom-area';

const isInsideMap = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(`[${MAP_ZOOM_AREA_ATTRIBUTE}]`) !== null;

/*
 * iOS 사파리는 viewport의 user-scalable=no를 무시하고 핀치로 화면 전체를 확대한다.
 * 사파리 전용 gesture 이벤트를 막아 지도가 아닌 곳의 화면 확대를 막는다.
 */
export const preventPageZoom = (target: Document = document): (() => void) => {
  const blockGesture = (event: Event) => {
    if (isInsideMap(event.target)) return;
    event.preventDefault();
  };

  target.addEventListener('gesturestart', blockGesture, { passive: false });
  target.addEventListener('gesturechange', blockGesture, { passive: false });
  return () => {
    target.removeEventListener('gesturestart', blockGesture);
    target.removeEventListener('gesturechange', blockGesture);
  };
};
