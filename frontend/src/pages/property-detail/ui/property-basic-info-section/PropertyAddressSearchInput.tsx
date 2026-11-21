import { css } from '@emotion/css';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

import useAddressSearch from '@/features/map/api/useAddressSearch';
import type { MapAddress } from '@/features/map/model/Map';
import AddressSearchResults, { handleSearchKeys } from '@/features/map/ui/address-search-results/AddressSearchResults';
import useOutsideInteraction from '@/shared/lib/hooks/useOutsideInteraction';
import Icon from '@/shared/ui/icon/Icon';

type Props = {
  /** 지금 저장된 주소. 검색 칸을 이 주소로 채워 열고, 취소하면 이 주소가 그대로 보인다. */
  currentAddress: string;
  /** 검색 결과에서 고른 주소와 좌표로 저장한다. 실패하면 거부해 입력을 열어 둔다. */
  onSave: (address: MapAddress) => Promise<void>;
  onSaved: () => void;
  /** 고치지 않고 닫는다. 바깥을 누르거나 Esc를 누를 때 부른다. */
  onCancel: () => void;
  /** 검색 대신 지도에서 자리를 찍어 고른다. 기존 지도 위치 고르기로 넘어간다. */
  onPickOnMap: () => void;
};

/**
 * 상세 기본 정보의 주소를 그 줄 안에서 검색해 바꾼다. 매물 이름 입력처럼 값 칸 안에만 놓여 라벨을 가리지 않고 줄 높이도 그대로다.
 * 결과는 칸 아래에 떠서 열리고, 고르면 바로 저장한다. 바깥을 누르거나 Esc를 누르면 저장하지 않고 닫아 직전 주소로 돌아간다.
 */
const PropertyAddressSearchInput = ({ currentAddress, onSave, onSaved, onCancel, onPickOnMap }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { results, status, submit, clear, changeQuery, query } = useAddressSearch();
  // 지금 주소를 채워 연다. 열 때 한 번만 채워, 저장 뒤 주소가 바뀌어도 고치던 검색어를 덮지 않는다.
  const filledRef = useRef(false);
  useEffect(() => {
    if (filledRef.current) return;
    filledRef.current = true;
    changeQuery(currentAddress);
  }, [changeQuery, currentAddress]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const cancel = useCallback(() => {
    if (!isSaving) onCancel();
  }, [isSaving, onCancel]);
  useOutsideInteraction({ ref: rootRef, onOutside: cancel });

  const change = (next: string) => {
    setSaveFailed(false);
    changeQuery(next);
  };

  const select = async (address: MapAddress) => {
    setIsSaving(true);
    setSaveFailed(false);
    try {
      await onSave(address);
      onSaved();
    } catch {
      setSaveFailed(true);
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Esc는 검색어만 지우지 않고 수정 자체를 취소해 직전 주소로 돌아간다. 아래 방향키는 결과로 옮긴다.
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
      return;
    }
    handleSearchKeys(event, clear);
  };

  return (
    <div ref={rootRef} className={styles.root} data-search-root onKeyDown={handleKeyDown}>
      <input
        className={styles.input}
        aria-label="주소 검색"
        placeholder="도로명, 지번, 건물 이름"
        value={query}
        autoFocus
        // 열자마자 전체를 골라 두어, 바로 치면 새 검색어로 바뀌고 조금만 고칠 수도 있다.
        onFocus={(event) => event.currentTarget.select()}
        readOnly={isSaving}
        enterKeyHint="search"
        onChange={(event) => change(event.target.value)}
      />
      <button
        className={styles.mapButton}
        type="button"
        aria-label="지도에서 고르기"
        title="지도에서 고르기"
        disabled={isSaving}
        onClick={onPickOnMap}
      >
        <Icon name="map" size={16} />
      </button>
      {/* 결과와 저장 상태는 칸 아래에 띄워, 줄 높이를 바꾸지 않는다. */}
      {isSaving || saveFailed ? (
        <div className={styles.overlay}>
          {isSaving ? (
            <p className={styles.status} role="status">
              주소를 저장하는 중이에요…
            </p>
          ) : (
            <p className={styles.error} role="alert">
              주소를 저장하지 못했어요. 다시 골라 주세요.
            </p>
          )}
        </div>
      ) : (
        <AddressSearchResults
          results={results}
          status={status}
          dropdown
          // 검색어를 다 지우면 최근 검색을 보인다.
          recent={query === ''}
          onSelect={(address) => void select(address)}
        />
      )}
    </div>
  );
};

const styles = {
  /* 값 칸 안에만 놓인다. 결과 드롭다운은 이 너비에 맞춰 칸 바로 아래에 뜬다. */
  root: css`
    label: PropertyAddressSearchInput-root;
    position: relative;
    /* 칸의 안쪽 여백과 테두리만큼 바깥을 당겨, 칸이 열려도 줄 높이는 글자 한 줄 그대로다. */
    margin-block: calc(-0.3rem - 1px);
    text-align: left;
  `,

  /* 매물 이름 입력과 같은 크기와 테두리. 오른쪽에 지도 버튼 자리를 둔다. */
  input: css`
    label: PropertyAddressSearchInput-input;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 0.3rem 2.25rem 0.3rem 0.6rem;
    border: 1px solid var(--color-border, #e3e5e9);
    border-radius: 0.6rem;
    background: #fff;
    color: var(--color-ink, #212124);
    font: inherit;
    text-overflow: ellipsis;
    outline: none;
    &::placeholder {
      color: #8b909a;
    }
    &:focus,
    &:focus-visible {
      outline: 0;
      border-color: var(--color-brand-blue-ink, #3f6fc4);
    }
  `,

  mapButton: css`
    label: PropertyAddressSearchInput-mapButton;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    display: grid;
    width: 2.25rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-brand-blue-ink, #3f6fc4);
    cursor: pointer;
    place-items: center;

    &:disabled {
      cursor: default;
      opacity: 0.5;
    }
  `,

  overlay: css`
    label: PropertyAddressSearchInput-overlay;
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    left: 0;
    z-index: 40;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-tile);
    background: var(--color-surface);
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 14%);
  `,

  status: css`
    label: PropertyAddressSearchInput-status;
    margin: 0;
    padding: 0.85rem 1rem;
    color: var(--color-muted, #868b94);
    font-size: 0.8rem;
  `,

  error: css`
    label: PropertyAddressSearchInput-error;
    margin: 0;
    padding: 0.85rem 1rem;
    color: var(--color-error, #e53e3e);
    font-size: 0.8rem;
  `,
};

export default PropertyAddressSearchInput;
