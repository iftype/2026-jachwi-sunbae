import { css } from '@emotion/css';

import { recentAddressLabel } from '../../lib/recentAddressStore';
import type { MapAddress } from '../../model/Map';

type RecentAddressListProps = {
  addresses: MapAddress[];
  onSelect: (address: MapAddress) => void;
  onRemove: (address: MapAddress) => void;
  onClear: () => void;
};

/** 검색창 아래에 띄우는 최근 검색 목록. 항목을 누르면 고른 것과 같고, x로 하나씩 `전체 지우기`로 모두 지운다. */
const RecentAddressList = ({ addresses, onSelect, onRemove, onClear }: RecentAddressListProps) => {
  if (addresses.length === 0) return null;
  return (
    <section aria-label="최근 검색">
      <div className={styles.head}>
        <h2>최근 검색</h2>
        <button type="button" onClick={onClear}>
          전체 지우기
        </button>
      </div>
      <ul className={styles.list} aria-label="최근 검색 목록">
        {addresses.map((address) => {
          const label = recentAddressLabel(address);
          const secondary = address.roadAddress !== null && address.jibunAddress !== null ? address.jibunAddress : null;
          return (
            <li key={label} className={styles.row}>
              <button type="button" className={styles.item} onClick={() => onSelect(address)}>
                <strong>{label || '주소 정보 없음'}</strong>
                {secondary !== null && <small>{secondary}</small>}
              </button>
              <button
                type="button"
                className={styles.remove}
                aria-label={`${label} 기록 지우기`}
                onClick={() => onRemove(address)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const styles = {
  head: css`
    label: RecentAddressList-head;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1rem 0.3rem;

    & h2 {
      margin: 0;
      color: var(--color-muted, #868b94);
      font-size: 0.75rem;
      font-weight: 700;
    }

    & button {
      border: 0;
      background: transparent;
      color: var(--color-muted, #868b94);
      font-size: 0.75rem;
      cursor: pointer;
    }
  `,

  list: css`
    label: RecentAddressList-list;
    margin: 0;
    padding: 0;
    list-style: none;
  `,

  row: css`
    label: RecentAddressList-row;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--color-border, #eaebed);

    &:last-child {
      border-bottom: 0;
    }

    &:hover {
      background: var(--color-surface-muted, #f2f3f5);
    }
  `,

  item: css`
    label: RecentAddressList-item;
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.75rem 0 0.75rem 1rem;
    border: 0;
    background: transparent;
    color: var(--color-ink, #212124);
    text-align: left;
    cursor: pointer;

    & strong,
    & small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & strong {
      font-size: 0.85rem;
      font-weight: 700;
    }

    & small {
      color: var(--color-muted, #868b94);
      font-size: 0.72rem;
    }
  `,

  remove: css`
    label: RecentAddressList-remove;
    flex: none;
    width: 2.25rem;
    height: 2.25rem;
    margin-right: 0.35rem;
    border: 0;
    background: transparent;
    color: var(--color-muted, #868b94);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
  `,
};

export default RecentAddressList;
