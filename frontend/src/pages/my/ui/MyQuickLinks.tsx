import { css } from '@emotion/css';

import cheapMealIcon from '@/pages/design-home/assets/cheap-meal-goose.webp';
import guideIcon from '@/pages/design-home/assets/guide-goose.webp';
import checklistIcon from '@/pages/design-home/assets/icon-checklist.webp';
import iconCompare from '@/shared/assets/illustrations/icon-compare.webp';
import { CHEAP_MEALS_PATH, CHECKLISTS_PATH, COMPARE_PATH, GUIDE_PATH } from '@/shared/lib/navigation/appPaths';
import ShortcutTile from '@/shared/ui/shortcut-tile/ShortcutTile';

/** 예전 홈 빠른 메뉴와 같은 그림 타일. 이름만으로 알 수 있어 설명 줄은 두지 않는다. */
const links = [
  { to: COMPARE_PATH, label: '방 비교', icon: iconCompare },
  { to: CHECKLISTS_PATH, label: '체크리스트', icon: checklistIcon },
  { to: CHEAP_MEALS_PATH, label: '저렴한 한 끼', icon: cheapMealIcon },
  { to: GUIDE_PATH, label: '사용방법', icon: guideIcon },
] as const;

const MyQuickLinks = () => (
  <nav className={styles.links} aria-label="내 도구">
    {links.map((link) => (
      <ShortcutTile key={link.to} {...link} />
    ))}
  </nav>
);

const styles = {
  /* 회색 화면 바탕 위에 흰 타일을 한 줄 4칸으로 왼쪽부터 채운다. 빈 칸은 자리만 남는다. */
  links: css`
    label: MyQuickLinks-links;
    /* 그림이 들어가는 칸에는 채도를 낮춘 연한 파랑 그라데이션의 둥근 네모를 깔고, 카드 둘레 테두리는 두지 않는다. */
    --color-card-surface: linear-gradient(145deg, #eef3ff 0%, #d6e2fb 100%);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem;

    & > a {
      padding: 0.35rem 0.35rem 0.6rem;
      border-radius: var(--my-card-radius);
      background: var(--my-card-surface);
    }

    /* 칸이 넓어져도 타일이 휴대폰 크기를 넘지 않게 상한을 둔다. */
    @media (min-width: 768px) {
      grid-template-columns: repeat(4, minmax(0, 5.5rem));
    }
  `,
};

export default MyQuickLinks;
