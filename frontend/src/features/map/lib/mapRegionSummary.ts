import type { MapRegion } from '../model/MapCanvas';

import styles from '../ui/map-canvas/MapRegionSummary.module.css';

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
  if (region.summary?.price !== undefined) rows.push(['거래 평균가', region.summary.price]);
  return rows;
};
