import { css } from '@emotion/css';

import type { MapRegionCard } from '../../model/MapCanvas';

const STAR_PATH = 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z';

const styles = {
  /* 요소 아래 가운데가 동 위치. 꼬리가 들어갈 자리를 아래에 비워 둔다. */
  wrap: css`
    label: MapRegionCard-wrap;
    position: relative;
    padding-bottom: 10px;
    pointer-events: auto;
  `,
  card: css`
    label: MapRegionCard-card;
    box-sizing: border-box;
    width: max-content;
    min-width: 0;
    max-width: 168px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 1px 8px rgb(0 0 0 / 12%);
    color: var(--color-ink, #25282d);
    text-align: left;
  `,
  head: css`
    label: MapRegionCard-head;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;

    & strong {
      min-width: 0;
      overflow: hidden;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.03em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  star: css`
    label: MapRegionCard-star;
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    margin: -3px -4px -3px 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #a4a7ab;
    cursor: pointer;

    &[aria-pressed='true'] {
      color: var(--color-brand-blue-ink, #3f6fc4);
    }
  `,
  subtitle: css`
    label: MapRegionCard-subtitle;
    margin: -4px 0 6px;
    color: var(--color-muted, #868b94);
    font-size: 12px;
    line-height: 1.4;
  `,
  line: css`
    label: MapRegionCard-line;
    margin: 0 0 6px;
    color: var(--color-ink-soft, #41444b);
    font-size: 12px;
    line-height: 1.45;
  `,
  link: css`
    label: MapRegionCard-link;
    display: block;
    margin-top: 10px;
    padding: 8px 0;
    border-radius: 8px;
    background: var(--color-brand-blue-ink, #3f6fc4);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
    text-align: center;
    text-decoration: none;
  `,
  action: css`
    label: MapRegionCard-action;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-ink, #25282d);
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
    cursor: pointer;

    & svg {
      flex: none;
      color: var(--color-brand-blue-ink, #3f6fc4);
    }
  `,
  note: css`
    label: MapRegionCard-note;
    margin: 8px 0 0;
    color: var(--color-muted, #868b94);
    font-size: 11px;
    line-height: 1.4;
  `,
  row: css`
    label: MapRegionCard-row;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
    font-size: 12px;
    line-height: 1.7;

    & dt {
      color: var(--color-muted, #868b94);
    }
    & dd {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    & dd[data-tone='primary'] {
      color: var(--color-brand-blue-ink, #3f6fc4);
    }
    & dd[data-empty] {
      color: var(--color-muted, #868b94);
      font-weight: 500;
    }
  `,
  tail: css`
    label: MapRegionCard-tail;
    position: absolute;
    bottom: 4px;
    left: calc(50% - 6px);
    width: 12px;
    height: 12px;
    background: #fff;
    box-shadow: 2px 2px 4px rgb(0 0 0 / 8%);
    transform: rotate(45deg);
  `,
};

/**
 * 행정동 정보 카드 DOM(지도 SDK 오버레이에 넣는다). 맨 위에 동 이름(굵게 16px)과 별 버튼, 아래에 라벨(회색)과 값(굵게)을 좌우로 나눈 줄,
 * 아래쪽 꼬리가 동 위치를 가리킨다. 카드 위 누름은 지도로 번지지 않고, 마우스가 들어오고 나감은 `onHoverChange`로 알린다.
 */
export const createMapRegionCardElement = (
  card: MapRegionCard,
  onHoverChange?: (hovered: boolean) => void,
  flip = false,
): HTMLElement => {
  const wrap = document.createElement('div');
  wrap.className = styles.wrap;
  const body = document.createElement('div');
  body.className = styles.card;
  if (card.action) {
    const { label, onClick } = card.action;
    const action = document.createElement('button');
    action.type = 'button';
    action.className = styles.action;
    action.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
    action.append(label);
    action.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    body.append(action);
  }
  const head = document.createElement('div');
  head.className = styles.head;
  const title = document.createElement('strong');
  title.textContent = card.title;
  head.append(title);
  if (card.action) head.style.display = 'none';
  if (card.bookmark) {
    const { isOn, onToggle } = card.bookmark;
    const star = document.createElement('button');
    star.type = 'button';
    star.className = styles.star;
    star.setAttribute('aria-pressed', String(isOn));
    star.setAttribute('aria-label', isOn ? '북마크 해제' : '북마크하기');
    star.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="${isOn ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
    star.addEventListener('click', (event) => {
      event.stopPropagation();
      onToggle();
    });
    head.append(star);
  }
  body.append(head);
  if (card.subtitle) {
    const subtitle = document.createElement('p');
    subtitle.className = styles.subtitle;
    subtitle.textContent = card.subtitle;
    body.append(subtitle);
  }
  card.lines?.forEach((text) => {
    const line = document.createElement('p');
    line.className = styles.line;
    line.textContent = text;
    body.append(line);
  });
  const list = document.createElement('div');
  card.rows.forEach((row) => {
    const line = document.createElement('dl');
    line.className = styles.row;
    const label = document.createElement('dt');
    label.textContent = row.label;
    const value = document.createElement('dd');
    value.textContent = row.value;
    if (row.isEmpty) value.dataset.empty = '';
    else if (row.tone) value.dataset.tone = row.tone;
    line.append(label, value);
    list.append(line);
  });
  body.append(list);
  if (card.link) {
    const { label, href, onClick } = card.link;
    const link = document.createElement('a');
    link.className = styles.link;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = label;
    link.addEventListener('click', () => onClick?.());
    body.append(link);
  }
  if (card.note) {
    const note = document.createElement('p');
    note.className = styles.note;
    note.textContent = card.note;
    body.append(note);
  }
  const tail = document.createElement('span');
  tail.className = styles.tail;
  // 가게 카드처럼 메뉴와 길찾기가 있는 카드는 읽히게 최소 200px을 둔다.
  if (card.link) {
    body.style.minWidth = '200px';
    body.style.maxWidth = '240px';
  }
  // 카드(꼬리 끝)는 마커 위쪽 가장자리에 4px 여유를 두고 닿게 한다. 화면 위쪽을 넘으면 마커 아래로 뒤집고 꼬리도 위로 뒤집는다.
  const above = card.markerAbove ?? 0;
  const below = card.markerBelow ?? 0;
  if (flip) {
    wrap.style.paddingBottom = '0';
    wrap.style.paddingTop = '10px';
    wrap.style.transform = `translateY(calc(100% + ${below + 4}px))`;
    tail.style.bottom = 'auto';
    tail.style.top = '4px';
  } else {
    wrap.style.paddingBottom = `${10 + above + 4}px`;
    tail.style.bottom = `${4 + above + 4}px`;
  }
  wrap.append(body, tail);
  ['click', 'pointerdown', 'mousedown', 'touchstart', 'dblclick'].forEach((type) =>
    wrap.addEventListener(type, (event) => event.stopPropagation()),
  );
  wrap.addEventListener('mouseenter', () => onHoverChange?.(true));
  wrap.addEventListener('mouseleave', () => onHoverChange?.(false));
  return wrap;
};
