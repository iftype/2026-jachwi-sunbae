import { css } from '@emotion/css';

import { formatStoreDistance, type GoodPriceStore } from '@/features/good-price/model/GoodPriceStore';

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

/** 값이 있는 메뉴 중 가장 싼 하나. 가격을 읽을 수 있는 메뉴가 없으면 null이다. */
const cheapestMenu = (menus: GoodPriceStore['menus']) =>
  menus.reduce<{ name: string; price: string; value: number } | null>((best, menu) => {
    const value = priceValue(menu.price);
    if (menu.price === null || value === null) return best;
    return best === null || value < best.value ? { name: menu.name, price: menu.price, value } : best;
  }, null);

/** 목록의 가게 한 칸. 이름, 업종과 거리, 가장 싼 메뉴 한 줄만 두고, 전체 메뉴는 상세(지도 위 정보 카드)에서 본다. */
const StoreCard = ({ store, onSelect, isSelected = false }: StoreCardProps) => {
  const menu = cheapestMenu(store.menus);
  return (
    <button
      type="button"
      id={`store-card-${store.id}`}
      className={styles.card}
      aria-pressed={isSelected}
      onClick={() => onSelect(store.id)}
      aria-label={`${store.name} 상세 보기`}
    >
      <strong className={styles.name}>{store.name}</strong>
      <span className={styles.meta}>
        {store.businessType}, 직선 {formatStoreDistance(store.distanceMeters)}
      </span>
      <span className={styles.menu}>{menu ? `${menu.name} ${menu.price}` : '등록된 메뉴 가격이 없어요'}</span>
    </button>
  );
};

export default StoreCard;

const styles = {
  card: css`
    label: StoreCard-card;

    display: grid;
    width: 100%;
    gap: 0.2rem;
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
  name: css`
    label: StoreCard-name;

    font-size: 0.94rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  `,
  meta: css`
    label: StoreCard-meta;

    overflow: hidden;
    color: var(--color-muted);
    font-size: 0.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  menu: css`
    label: StoreCard-menu;

    overflow: hidden;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
};
