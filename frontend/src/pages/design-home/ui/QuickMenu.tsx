import ShortcutTile from '@/shared/ui/shortcut-tile/ShortcutTile';

import iconChecklist from '../assets/icon-checklist.webp';
import iconCompare from '../assets/icon-compare.webp';

import styles from './QuickMenu.module.css';

const QUICK_MENU_ITEMS = [
  { label: '체크리스트', to: '/checklists', icon: iconChecklist },
  { label: '방 비교', to: '/compare', icon: iconCompare },
];
// 나머지 칸은 들어갈 기능이 정해질 때까지 보이지 않는 빈칸으로 자리만 잡는다.
const EMPTY_SLOT_COUNT = 2;

const QuickMenu = () => (
  <nav className={styles.menu} aria-label="빠른 메뉴">
    {QUICK_MENU_ITEMS.map((item) => (
      <ShortcutTile key={item.to} {...item} />
    ))}
    {Array.from({ length: EMPTY_SLOT_COUNT }, (_, index) => (
      <span key={index} className={styles.emptySlot} aria-hidden="true" />
    ))}
  </nav>
);

export default QuickMenu;
