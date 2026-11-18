import { css } from '@emotion/css';

import cheapMealIcon from '@/pages/design-home/assets/cheap-meal-goose.webp';
import guideIcon from '@/pages/design-home/assets/guide-goose.webp';
import checklistIcon from '@/pages/design-home/assets/icon-checklist.webp';
import { PROPERTY_PLACEHOLDER } from '@/shared/assets/propertyImageAssets';
import { CHEAP_MEALS_PATH, CHECKLISTS_PATH, COMPARE_PATH, GUIDE_PATH } from '@/shared/lib/navigation/appPaths';
import ShortcutTile from '@/shared/ui/shortcut-tile/ShortcutTile';

/** 예전 홈 빠른 메뉴와 같은 그림 타일. 이름만으로 알 수 있어 설명 줄은 두지 않는다. */
const links = [
  { to: COMPARE_PATH, label: '방 비교', icon: PROPERTY_PLACEHOLDER.src },
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
    /* 공용 타일의 그림 칸 바탕은 투명하게 두고, 그림과 이름을 함께 감싼 흰 카드 하나로 보이게 한다. */
    --color-card-surface: transparent;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem;

    & > a {
      padding: 0.35rem 0.35rem 0.6rem;
      border-radius: var(--my-card-radius);
      background: var(--my-card-surface);
      border: 1px solid var(--color-border);
    }

    /* 칸이 넓어져도 타일이 휴대폰 크기를 넘지 않게 상한을 둔다. */
    @media (min-width: 768px) {
      grid-template-columns: repeat(4, minmax(0, 5.5rem));
    }
  `,
};

export default MyQuickLinks;
