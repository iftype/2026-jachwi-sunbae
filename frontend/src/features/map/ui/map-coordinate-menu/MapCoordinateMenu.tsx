import type { MapCoordinateMenu as MapCoordinateMenuModel } from '../../model/MapCanvas';

import styles from './MapCoordinateMenu.module.css';

type Props = {
  menu: MapCoordinateMenuModel;
};

const DEFAULT_TITLE = '이 위치에서';

/** 데모 지도에서 쓰는 말풍선. 실제 지도는 같은 모양을 createMapCoordinateMenuElement로 만들어 지도 좌표에 붙인다. */
const MapCoordinateMenu = ({ menu }: Props) => (
  <div className={styles.menu} role="menu" aria-label={menu.title ?? DEFAULT_TITLE}>
    <div className={styles.header}>
      <span>{menu.title ?? DEFAULT_TITLE}</span>
      <button type="button" className={styles.close} aria-label="닫기" onClick={menu.onClose}>
        ×
      </button>
    </div>
    {menu.actions.map((action) => (
      <button key={action.id} type="button" role="menuitem" className={styles.action} onClick={action.onSelect}>
        {action.label}
      </button>
    ))}
  </div>
);

/**
 * 지도 SDK 오버레이에 넣을 말풍선. 지도 클릭으로 번지지 않게 버튼 클릭 전파를 막는다.
 * React 트리 밖에서 그리므로 MapCoordinateMenu와 같은 클래스·구조를 DOM으로 직접 만든다.
 */
export const createMapCoordinateMenuElement = (menu: MapCoordinateMenuModel): HTMLElement => {
  const title = menu.title ?? DEFAULT_TITLE;
  const root = document.createElement('div');
  root.className = styles.menu;
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', title);
  const header = document.createElement('div');
  header.className = styles.header;
  const label = document.createElement('span');
  label.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = styles.close;
  close.setAttribute('aria-label', '닫기');
  close.textContent = '×';
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.onClose();
  });
  header.append(label, close);
  root.append(header);
  menu.actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = styles.action;
    button.setAttribute('role', 'menuitem');
    button.textContent = action.label;
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
  return root;
};

export default MapCoordinateMenu;
