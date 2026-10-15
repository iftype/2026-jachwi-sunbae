import { Link } from 'react-router-dom';

import styles from './ShortcutTile.module.css';

type ShortcutTileBaseProps = {
  /** 타일 아래에 보이는 기능 이름. 두 줄을 넘으면 말줄임한다. */
  label: string;
  /** 타일 안에 들어가는 정사각형 아이콘 이미지. */
  icon: string;
  className?: string;
};

type ShortcutTileProps = ShortcutTileBaseProps &
  ({ to: string; onClick?: never } | { to?: never; onClick: () => void });

/**
 * 정사각형 아이콘 타일과 이름으로 된 바로가기. 타일 크기는 놓인 칸 너비를 따르므로 그리드에 넣어 쓴다.
 * 화면 이동이면 `to`로 링크를, 동작이면 `onClick`으로 버튼을 그린다.
 */
const ShortcutTile = ({ label, icon, className, to, onClick }: ShortcutTileProps) => {
  const classes = `${styles.shortcut} ${className ?? ''}`.trim();
  const content = (
    <>
      <span className={styles.tile} aria-hidden="true">
        <img src={icon} alt="" width={192} height={192} />
      </span>
      <span className={styles.label}>{label}</span>
    </>
  );

  if (to !== undefined) {
    return (
      <Link className={classes} to={to}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  );
};

export default ShortcutTile;
