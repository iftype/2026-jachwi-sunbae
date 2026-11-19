import { css } from '@emotion/css';

import type { MapCoordinateMenu as MapCoordinateMenuModel } from '../../model/MapCanvas';

type Props = {
  menu: MapCoordinateMenuModel;
};

const DEFAULT_TITLE = '이 위치에서';

/** 마커 위에 놓는 말풍선은 꼬리 끝이 마커 위쪽 가장자리에 닿게 그 높이만큼 더 띄운다. */
const anchorStyle = (menu: MapCoordinateMenuModel) =>
  menu.markerAbove ? { paddingBottom: `calc(0.45rem + ${menu.markerAbove}px)` } : undefined;

/**
 * 데모 지도에서 쓰는 말풍선. 실제 지도는 같은 모양을 createMapCoordinateMenuElement로 만들어 지도 좌표에 붙인다.
 * 제목과 닫기 버튼은 두지 않는다. 지도 빈 곳을 다시 찍으면 닫힌다.
 */
const MapCoordinateMenu = ({ menu }: Props) => (
  <div className={styles.anchor} style={anchorStyle(menu)}>
    <div className={styles.menu} role="menu" aria-label={menu.title ?? DEFAULT_TITLE}>
      {menu.heading && <p className={styles.heading}>{menu.heading}</p>}
      {menu.note && <p className={styles.note}>{menu.note}</p>}
      {menu.actions.map((action) =>
        action.href !== undefined ? (
          <a
            key={action.id}
            role="menuitem"
            className={styles.action}
            href={action.href}
            aria-label={action.ariaLabel}
            onClick={action.onSelect}
          >
            {action.label}
          </a>
        ) : (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            className={styles.action}
            aria-label={action.ariaLabel}
            onClick={action.onSelect}
          >
            {action.icon && <img className={styles.icon} src={action.icon} alt="" draggable={false} />}
            {action.label}
          </button>
        ),
      )}
    </div>
  </div>
);

/**
 * 지도 SDK 오버레이에 넣을 말풍선. 지도 클릭으로 번지지 않게 버튼 클릭 전파를 막는다.
 * React 트리 밖에서 그리므로 MapCoordinateMenu와 같은 클래스·구조를 DOM으로 직접 만든다.
 */
export const createMapCoordinateMenuElement = (menu: MapCoordinateMenuModel): HTMLElement => {
  const anchor = document.createElement('div');
  anchor.className = styles.anchor;
  const anchorPadding = anchorStyle(menu);
  if (anchorPadding) anchor.style.paddingBottom = anchorPadding.paddingBottom;
  const root = document.createElement('div');
  root.className = styles.menu;
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', menu.title ?? DEFAULT_TITLE);
  anchor.append(root);
  if (menu.heading) {
    const heading = document.createElement('p');
    heading.className = styles.heading;
    heading.textContent = menu.heading;
    root.append(heading);
  }
  if (menu.note) {
    const note = document.createElement('p');
    note.className = styles.note;
    note.textContent = menu.note;
    root.append(note);
  }
  menu.actions.forEach((action) => {
    const button = document.createElement(action.href !== undefined ? 'a' : 'button');
    if (button instanceof HTMLButtonElement) button.type = 'button';
    if (button instanceof HTMLAnchorElement && action.href !== undefined) button.href = action.href;
    if (action.ariaLabel !== undefined) button.setAttribute('aria-label', action.ariaLabel);
    button.className = styles.action;
    button.setAttribute('role', 'menuitem');
    if (action.icon !== undefined) {
      const icon = document.createElement('img');
      icon.className = styles.icon;
      icon.src = action.icon;
      icon.alt = '';
      icon.draggable = false;
      button.append(icon);
    }
    button.append(document.createTextNode(action.label));
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      action.onSelect();
    });
    root.append(button);
  });
  // 말풍선 위 클릭·드래그가 지도 클릭이나 지도 이동으로 이어지지 않게 한다.
  ['click', 'pointerdown', 'mousedown', 'touchstart', 'dblclick'].forEach((type) =>
    root.addEventListener(type, (event) => event.stopPropagation()),
  );
  return anchor;
};

const styles = {
  /* 찍은 자리에 따로 핀을 두지 않고, 말풍선 꼬리 끝(아래로 0.45rem)이 찍은 좌표를 바로 가리키게 그만큼 아래를 비운다. */
  anchor: css`
    label: MapCoordinateMenu-anchor;
    padding-bottom: 0.45rem;
    pointer-events: none;
  `,

  /* 찍은 좌표를 꼬리 끝으로 가리키는 동작 말풍선. */
  menu: css`
    label: MapCoordinateMenu-menu;
    position: relative;
    display: grid;
    gap: 0.25rem;
    min-width: 11rem;
    padding: 0.5rem;
    pointer-events: auto;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    background: var(--color-surface);
    color: var(--color-ink);
    box-shadow: 0 0.4rem 1.2rem rgb(0 0 0 / 16%);
    z-index: 40;

    &::after {
      position: absolute;
      bottom: -0.45rem;
      left: 50%;
      width: 0.8rem;
      height: 0.8rem;
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      content: '';
      transform: translateX(-50%) rotate(45deg);
    }
  `,

  heading: css`
    label: MapCoordinateMenu-heading;
    margin: 0;
    padding: 0.35rem 0.7rem;
    font-size: 0.875rem;
    font-weight: 700;
    white-space: nowrap;
  `,

  note: css`
    label: MapCoordinateMenu-note;
    margin: 0;
    padding: 0.25rem 0.7rem 0;
    color: var(--color-muted, #868b94);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  `,

  icon: css`
    label: MapCoordinateMenu-icon;
    width: 1.5rem;
    height: 1.5rem;
    flex: none;
    object-fit: contain;
  `,

  action: css`
    label: MapCoordinateMenu-action;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.7rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: inherit;
    font-size: 0.875rem;
    font-weight: 650;
    text-align: left;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      background: var(--color-surface-muted);
    }
  `,
};

export default MapCoordinateMenu;
