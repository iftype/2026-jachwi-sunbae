import { css } from '@emotion/css';

import type { GoodPriceStore } from '@/features/good-price/model/GoodPriceStore';

type StoreCardProps = {
  store: GoodPriceStore;
  onSelect: (id: number) => void;
  /** 지도나 목록에서 고른 가게. 파란 테두리로 표시한다. */
  isSelected?: boolean;
};

/** `56,700원` 같은 가격 글자에서 숫자를 읽는다. 읽을 수 없으면 null이다. */
const priceValue = (price: string | null): number | null => {
  if (price === null) return null;
  const digits = price.replace(/[^\d]/g, '');
  return digits === '' ? null : Number(digits);
};

/** 카드에 보여 줄 메뉴 수. 가격을 읽을 수 있는 메뉴 중 싼 순서로 둔다. */
const MAX_MENUS = 2;

/** 가격을 읽을 수 있는 메뉴 중 싼 것부터 최대 MAX_MENUS개. 없으면 빈 배열이다. */
const cheapestMenus = (menus: GoodPriceStore['menus']) =>
  menus
    .flatMap((menu) => {
      const value = priceValue(menu.price);
      return menu.price === null || value === null ? [] : [{ name: menu.name, price: menu.price, value }];
    })
    .sort((a, b) => a.value - b.value)
    .slice(0, MAX_MENUS);

/** 목록의 가게 한 칸. 왼쪽에 이름과 업종 뱃지, 오른쪽에 싼 메뉴와 가격을 둔다. 전체 메뉴는 상세(지도 위 정보 카드)에서 본다. */
const StoreCard = ({ store, onSelect, isSelected = false }: StoreCardProps) => {
  const menus = cheapestMenus(store.menus);
  return (
    <button
      type="button"
      id={`store-card-${store.id}`}
      className={styles.card}
      aria-pressed={isSelected}
      onClick={() => onSelect(store.id)}
      aria-label={`${store.name} 상세 보기`}
    >
      <span className={styles.info}>
        <strong className={styles.name}>{store.name}</strong>
        <span className={styles.badge}>{store.businessType}</span>
      </span>
      {menus.length > 0 ? (
        <span className={styles.menus}>
          {menus.map((menu) => (
            <span key={menu.name} className={styles.menu}>
              <span className={styles.menuName}>{menu.name}</span>
              <strong className={styles.price}>{menu.price}</strong>
            </span>
          ))}
        </span>
      ) : (
        <span className={styles.empty}>등록된 메뉴 가격이 없어요</span>
      )}
    </button>
  );
};

export default StoreCard;

const styles = {
  card: css`
    label: StoreCard-card;

    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid transparent;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink);
    text-align: left;
    cursor: pointer;

    &[aria-pressed='true'] {
      border: 1px solid var(--color-brand-blue-ink);
      border-radius: 8px;
      background: color-mix(in srgb, var(--color-brand-blue-ink) 6%, var(--color-surface));
    }
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: -2px;
    }
  `,
  info: css`
    label: StoreCard-info;

    display: grid;
    min-width: 0;
    flex: 1;
    gap: 0.3rem;
    justify-items: start;
  `,
  name: css`
    label: StoreCard-name;

    font-size: 0.94rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  `,
  badge: css`
    label: StoreCard-badge;

    max-width: 100%;
    overflow: hidden;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--color-surface-neutral);
    color: var(--color-muted);
    font-size: 0.7rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  menus: css`
    label: StoreCard-menus;

    display: grid;
    min-width: 0;
    max-width: 55%;
    flex: none;
    gap: 0.15rem;
    text-align: right;
  `,
  menu: css`
    label: StoreCard-menu;

    display: flex;
    min-width: 0;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0.4rem;
    font-size: 0.8rem;
  `,
  menuName: css`
    label: StoreCard-menuName;

    min-width: 0;
    overflow: hidden;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  price: css`
    label: StoreCard-price;

    flex: none;
    color: var(--color-ink);
    font-size: 0.9rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  `,
  empty: css`
    label: StoreCard-empty;

    flex: none;
    max-width: 45%;
    color: var(--color-muted);
    font-size: 0.75rem;
    text-align: right;
  `,
};
