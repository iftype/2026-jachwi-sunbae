/**
 * 주소로 지도 이동한 자리를 표시하는 단순한 핀. 매물 핀이나 동네 찾기의 목적지 핀과 헷갈리지 않게 검은 물방울에 흰 점 하나만 둔다.
 * 핀 끝이 칸 아래 가운데에 온다.
 */
const SEARCHED_PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
  '<g transform="translate(10.4 12.2) scale(0.85)">' +
  '<path d="M16 41C16 41 2 25.6 2 15.5A14 14 0 0 1 30 15.5C30 25.6 16 41 16 41Z" fill="#25282d" stroke="#fff" stroke-width="2.5"/>' +
  '<circle cx="16" cy="15.5" r="5.5" fill="#fff"/></g></svg>';

export const SEARCHED_PIN_IMAGE = { src: `data:image/svg+xml;utf8,${encodeURIComponent(SEARCHED_PIN_SVG)}` };
