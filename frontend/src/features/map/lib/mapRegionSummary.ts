import type { MapRegion } from '../model/MapCanvas';

import * as styles from '../ui/map-canvas/MapRegionSummary.styles';

export const regionLabelPosition = (region: MapRegion) => {
  if (region.center) return region.center;
  const points = region.paths[0].slice(0, -1);
  return {
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
  };
};

export const createRegionSummaryElement = (region: MapRegion, selected: boolean, onSelect: () => void) => {
  const button = document.createElement('button');
  button.className = styles.summary;
  if (region.appearance) {
    button.dataset.colored = 'true';
    button.style.setProperty('--region-accent', region.appearance.strokeColor);
  }
  const rows = regionSummaryRows(region);
  button.setAttribute('aria-label', `${region.name} ${rows.map(([label]) => label).join('과 ')}`);
  button.setAttribute('aria-pressed', String(selected));
  const name = document.createElement('strong');
  name.textContent = region.name;
  button.append(name);
  const cells = document.createElement('span');
  cells.className = styles.cells;
  for (const [label, value] of rows) {
    const cell = document.createElement('span');
    const caption = document.createElement('small');
    caption.textContent = label ?? '';
    const text = document.createElement('b');
    text.textContent = value ?? '정보 부족';
    cell.append(caption, text);
    cells.append(cell);
  }
  button.append(cells);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  return button;
};

export const regionSummaryRows = (region: MapRegion): [string, string][] => {
  const rows: [string, string][] = [];
  if (region.summary?.travel !== undefined) rows.push(['이동 시간', region.summary.travel]);
  if (region.summary?.price !== undefined) rows.push(['월세 시세', region.summary.price]);
  return rows;
};

/**
 * 동 이름 아래에 통근 시간과 평균 월세를 붙인 가벼운 라벨. 동네마다 하나씩 둔다.
 * 월세 시세가 없는 동은 `월세 정보 없음`을 적고, 거래가 적은 동은 글자 없이 회색으로만 흐리게 한다.
 */
export const createRegionRentLabelElement = (region: MapRegion, selected: boolean, onSelect: () => void) => {
  const rent = region.rentLabel;
  const button = document.createElement('button');
  button.className = styles.rentLabel;
  button.dataset.sparse = String(rent?.sparse ?? false);
  button.dataset.filteredOut = String(rent?.filteredOut ?? false);
  const isSaved = rent?.isBookmarked === true;
  if (isSaved) button.dataset.saved = 'true';
  // 월세 줄 없이 이름만 두는 라벨(찜한 동네)은 크게 그려 찜한 영역이 눈에 띄게 한다.
  const isBookmark = region.showsName === true && !rent;
  if (isBookmark) button.dataset.bookmark = 'true';
  button.setAttribute('aria-pressed', String(selected));
  const commuteText = rent?.commute ? `통근 ${rent.commute}` : null;
  const priceText = rent?.price
    ? `월세 ${rent.price}, 거래 ${rent.count}건${rent.sparse ? ', 자료 적음' : ''}`
    : rent
      ? '월세 정보 없음'
      : null;
  const caption = isBookmark ? region.nameCaption : undefined;
  button.setAttribute(
    'aria-label',
    [isSaved ? '찜한 동네' : null, region.name, commuteText, priceText, caption].filter(Boolean).join(' '),
  );
  const name = document.createElement('strong');
  name.textContent = region.name;
  if (isSaved) {
    const star = document.createElement('span');
    star.textContent = '★';
    star.className = styles.savedStar;
    star.setAttribute('aria-hidden', 'true');
    name.prepend(star);
  }
  button.append(name);
  // 찜한 동네는 이름 옆에 월세 시세를 붙인다.
  if (caption) {
    const note = document.createElement('small');
    note.textContent = caption;
    button.append(note);
  }
  // 통근 시간은 동 색(15분 이하, 16~30분...)으로 이미 알리므로 이름표 글자에는 쓰지 않는다. 화면 낭독기에는 위 aria-label로 읽어 준다.
  if (rent) {
    const line = document.createElement('span');
    const price = document.createElement('b');
    price.textContent = rent.price ? `월세 ${rent.price}` : '월세 정보 없음';
    price.dataset.empty = String(!rent.price);
    line.append(price);
    // 자료가 적은 동은 글자 없이 회색(data-sparse)으로만 구분한다.
    button.append(line);
  }
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  return button;
};
