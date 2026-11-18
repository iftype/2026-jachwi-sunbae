import { css, cx } from '@emotion/css';
import type { KeyboardEvent } from 'react';

import type { AddressSearchStatus } from '../../model/AddressSearch';
import type { MapAddress } from '../../model/Map';

/**
 * 검색창 묶음(입력창과 결과 목록을 함께 감싼 요소)의 키 처리. 입력창에서 아래 방향키를 누르면 첫 결과로, Esc는 목록을 닫고 입력창에 둔다.
 * Tab은 입력창 다음 칸(지우기 버튼은 Tab 순서 밖)인 첫 결과로 그대로 간다.
 */
export const handleSearchKeys = (event: KeyboardEvent<HTMLElement>, close: () => void) => {
  if (event.key === 'Escape') {
    close();
    event.currentTarget.querySelector('input')?.focus();
  } else if (event.key === 'ArrowDown' && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
    const first = event.currentTarget.querySelector<HTMLButtonElement>('ul[aria-label="주소 검색 결과"] button');
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
};

type AddressSearchResultsProps = {
  results: MapAddress[];
  status: AddressSearchStatus;
  onSelect: (address: MapAddress) => void;
  dropdown?: boolean;
  /** 좁은 입력창 아래에서 주소가 잘리지 않게 목록을 가까운 위치 기준 칸 전체 너비로 두고 줄바꿈을 허용한다. */
  wide?: boolean;
  errorMessage?: string;
};
/** API와 라우터 없이 검색 결과·로딩·오류를 표현한다. 지도와 위치 선택에서 함께 쓴다. */
const AddressSearchResults = ({
  results,
  status,
  onSelect,
  dropdown = false,
  wide = false,
  errorMessage = '주소를 찾지 못했어요. 다시 시도해 주세요.',
}: AddressSearchResultsProps) => {
  if (dropdown && status === 'idle') return null;
  /** 결과 사이를 위아래 방향키로 옮긴다. 맨 위에서 위로 가면 입력창으로 돌아간다. Esc와 입력창에서의 아래 방향키는 검색창 쪽(`handleSearchKeys`)이 맡는다. */
  const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const index = items.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown' && index < items.length - 1) {
      event.preventDefault();
      items[index + 1]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index > 0) items[index - 1]?.focus();
      else event.currentTarget.closest('[data-search-root]')?.querySelector('input')?.focus();
    }
  };
  const content = (
    <>
      {status === 'loading' && (
        <p className={styles.state} role="status">
          주소를 찾는 중이에요…
        </p>
      )}
      {status === 'error' && (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}
      {status === 'success' && results.length === 0 && <p className={styles.state}>검색 결과가 없어요.</p>}
      {status === 'success' && results.length > 0 && (
        <ul className={styles.results} aria-label="주소 검색 결과" onKeyDown={moveFocus}>
          {results.map((result) => {
            const primary = result.roadAddress ?? result.jibunAddress ?? result.address ?? '주소 정보 없음';
            const secondary = result.roadAddress !== null && result.jibunAddress !== null ? result.jibunAddress : null;

            return (
              <li key={`${result.latitude}-${result.longitude}`}>
                <button type="button" className={styles.item} onClick={() => onSelect(result)}>
                  <span className={styles.text}>
                    <strong>{primary}</strong>
                    {secondary !== null && <small>{secondary}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
  return dropdown ? <div className={cx(styles.dropdown, wide && styles.wide)}>{content}</div> : content;
};

const styles = {
  dropdown: css`
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    left: 0;
    z-index: 40;
    max-height: 16rem;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-tile);
    background: var(--color-surface);
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 14%);
    pointer-events: auto;
  `,
  /* 긴 주소를 줄바꿈해 끝까지 보인다. 너비는 가장 가까운 position: relative 조상이 정한다. */
  wide: css`
    label: AddressSearchResults-wide;
    & strong,
    & small {
      overflow: visible;
      text-overflow: clip;
      white-space: normal;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }
  `,
  state: css`
    label: AddressSearchResults-state;
    padding: 2rem 1rem;
    font-size: 0.85rem;
    text-align: center;
    color: var(--color-muted, #868b94);
  `,

  error: css`
    label: AddressSearchResults-error;
    padding: 2rem 1rem;
    font-size: 0.85rem;
    text-align: center;
    color: var(--color-error, #e53e3e);
  `,

  // 다른 요소의 선택자에서 `.AddressSearchResults-results`로 가리킨다.
  results: cx(
    css`
      label: AddressSearchResults-results;
      display: grid;
      gap: 0;
      margin: 0;
      padding: 0;
      border-top: 1px solid var(--color-border, #eaebed);
      border-bottom: 1px solid var(--color-border, #eaebed);
      background: var(--color-surface, #fff);
      list-style: none;
    `,
    'AddressSearchResults-results',
  ),

  item: css`
    label: AddressSearchResults-item;
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border: 0;
    border-bottom: 1px solid var(--color-border, #eaebed);
    background: transparent;
    color: var(--color-ink, #212124);
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;

    .AddressSearchResults-results li:last-child & {
      border-bottom: 0;
    }

    &:hover {
      background: var(--color-surface-muted, #f2f3f5);
    }
  `,

  text: css`
    label: AddressSearchResults-text;
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 0.15rem;

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
};

export default AddressSearchResults;
