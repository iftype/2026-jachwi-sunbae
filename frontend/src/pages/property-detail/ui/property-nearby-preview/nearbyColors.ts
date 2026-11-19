/**
 * 매물 자리에 꽂는 기본 파란 핀. 그림이나 글자 없이 물방울 모양에 흰 점 하나만 둔다.
 * 지도 마커 칸(약 2.6rem)을 다 채우면 점들을 가려서, 칸 아래 가운데에 작게 그린다. 핀 끝이 칸 아래 가운데에 온다.
 */
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
  '<g transform="translate(10.4 12.2) scale(0.85)">' +
  '<path d="M16 41C16 41 2 25.6 2 15.5A14 14 0 0 1 30 15.5C30 25.6 16 41 16 41Z" fill="#3f6fc4" stroke="#fff" stroke-width="2.5"/>' +
  '<circle cx="16" cy="15.5" r="5.5" fill="#fff"/></g></svg>';

export const PROPERTY_PIN_IMAGE = { src: `data:image/svg+xml,${encodeURIComponent(PIN_SVG)}` };
