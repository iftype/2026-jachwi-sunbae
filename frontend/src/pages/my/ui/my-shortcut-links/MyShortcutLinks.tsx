import { css, cx } from '@emotion/css';
import { Link } from 'react-router-dom';

import iconCompare from '@/shared/assets/illustrations/icon-compare.webp';
import cheapMealIcon from '@/shared/assets/illustrations/nav-cheap-meal.webp';
import checklistIcon from '@/shared/assets/illustrations/nav-checklist.webp';
import guideIcon from '@/shared/assets/illustrations/nav-guide.webp';
import { CHEAP_MEALS_PATH, CHECKLISTS_PATH, COMPARE_PATH, GUIDE_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

import * as rowStyles from '../my-row-card/MyRowCard.styles';

/** 지도 밖 도구 화면. 내 기록과 동네 찾기는 지도 머리의 모드 타일로 오가므로 여기 두지 않는다. */
const SHORTCUTS = [
  { label: '체크리스트', image: checklistIcon, path: CHECKLISTS_PATH },
  { label: '방 비교', image: iconCompare, path: COMPARE_PATH },
  { label: '저렴한 한 끼', image: cheapMealIcon, path: CHEAP_MEALS_PATH },
  { label: '사용방법', image: guideIcon, path: GUIDE_PATH },
] as const;

/** 마이페이지의 바로가기 목록. 하단 탭과 데스크탑 왼쪽 레일에 있던 도구 화면을 개인정보 처리방침 줄과 같은 모양으로 둔다. */
const MyShortcutLinks = () => (
  <nav className={styles.list} aria-labelledby="my-shortcuts-title">
    <h2 id="my-shortcuts-title" className="sr-only">
      바로가기
    </h2>
    {SHORTCUTS.map((item) => (
      <Link key={item.path} to={item.path} className={cx(rowStyles.notice, styles.row)}>
        <span>
          <img src={item.image} alt="" width={28} height={28} />
          <strong>{item.label}</strong>
        </span>
        <Icon name="chevron-right" size={16} />
      </Link>
    ))}
  </nav>
);

const styles = {
  list: css`
    label: MyShortcutLinks-list;
    display: grid;
    gap: 0.35rem;
  `,
  /* 계정 관리 줄보다 자주 쓰므로 글자를 본문 색으로 두고, 앞에 화면 그림을 둔다. */
  row: css`
    label: MyShortcutLinks-row;
    color: var(--color-ink);

    & > span {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    & img {
      flex: none;
      width: 28px;
      height: 28px;
      border-radius: 22%;
      object-fit: contain;
    }
  `,
};

export default MyShortcutLinks;
