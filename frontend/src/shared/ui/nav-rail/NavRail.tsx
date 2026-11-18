import { css } from '@emotion/css';

type NavRailItem = {
  key: string;
  label: string;
  /** 글자 위에 놓을 그림 주소. */
  image: string;
  isActive: boolean;
  onSelect: () => void;
  /** 레일 맨 아래에 붙인다. */
  isBottom?: boolean;
  /** 이동이 아니라 동작을 여는 칸. 파랗게 채워 눈에 띄게 한다. */
  isPrimary?: boolean;
};

type Props = { items: NavRailItem[]; label: string };

/** 데스크탑 지도 화면 맨 왼쪽의 세로 내비게이션. 그림을 위에, 글자를 아래에 두고 지금 보는 화면은 파랗게 칠한다. */
const NavRail = ({ items, label }: Props) => (
  <nav className={styles.rail} aria-label={label}>
    {items.map((item) => (
      <button
        key={item.key}
        type="button"
        className={styles.item}
        data-bottom={item.isBottom || undefined}
        data-primary={item.isPrimary || undefined}
        aria-current={item.isActive ? 'page' : undefined}
        onClick={item.onSelect}
      >
        <img src={item.image} alt="" width={28} height={28} />
        <span>{item.label}</span>
      </button>
    ))}
  </nav>
);

/**
 * 화면 코드를 받는 동안 뼈대가 레일 자리를 비워 두지 않도록 같은 폭과 모양으로 그리는 자리 표시.
 * 누를 수 없고, 실제 레일(`NavRail`)과 같은 칸 구성이라 뼈대에서 내용으로 바뀔 때 옆이 흔들리지 않는다.
 */
export const NavRailPlaceholder = ({
  items,
}: {
  items: readonly Pick<NavRailItem, 'key' | 'label' | 'image' | 'isBottom' | 'isPrimary'>[];
}) => (
  <div className={styles.rail} aria-hidden="true">
    {items.map((item) => (
      <div key={item.key} className={styles.item} data-bottom={item.isBottom || undefined}>
        <img src={item.image} alt="" width={28} height={28} />
        <span>{item.label}</span>
      </div>
    ))}
  </div>
);

const styles = {
  rail: css`
    label: NavRail-rail;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    box-sizing: border-box;
    width: 76px;
    height: 100%;
    padding: 12px 6px;
    overflow-y: auto;
    border-right: 1px solid #e3e5e9;
    background: #fff;
  `,
  item: css`
    label: NavRail-item;
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 10px 2px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--color-muted);
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.25;
    text-align: center;
    word-break: keep-all;
    cursor: pointer;

    & img {
      width: 28px;
      height: 28px;
      border-radius: 22%;
      object-fit: contain;
      opacity: 0.8;
    }
    &[data-bottom='true'] {
      margin-top: auto;
    }
    &[data-primary='true'] {
      margin-bottom: 8px;
      background: color-mix(in srgb, var(--color-brand-blue-ink) 92%, transparent);
      color: #fff;
    }
    &[data-primary='true']:hover {
      background: var(--color-brand-blue-ink);
    }
    &[data-primary='true'] img {
      opacity: 1;
    }
    &:hover {
      background: var(--color-surface-muted);
    }
    &[aria-current='page'] {
      background: color-mix(in srgb, var(--color-brand-blue-ink) 10%, var(--color-surface));
      color: var(--color-brand-blue-ink);
    }
    &[aria-current='page'] img {
      opacity: 1;
    }
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
};

export default NavRail;
