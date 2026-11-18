import { css } from '@emotion/css';
import type { FormEvent } from 'react';
import { useId, useRef } from 'react';

import Icon from '../icon/Icon';

type SearchFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  shape?: 'rounded' | 'pill';
  onBack?: () => void;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
  showSubmitButton?: boolean;
  /** 다른 form 안에 배치할 때 중첩 form을 피한다. */
  renderAsForm?: boolean;
};

const SearchField = ({
  label,
  value,
  placeholder,
  maxLength,
  disabled = false,
  autoFocus = false,
  className,
  shape = 'rounded',
  onBack,
  onValueChange,
  onSubmit,
  onClear,
  showSubmitButton = true,
  renderAsForm = true,
}: SearchFieldProps) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disabled) onSubmit();
  };

  const hasValue = value.length > 0;
  const clear = () => {
    onValueChange('');
    onClear?.();
    // 지우고 나서도 포커스를 입력 칸에 둔다.
    inputRef.current?.focus();
  };

  const fieldContent = (
    <>
      <label className={styles.srOnly} htmlFor={inputId}>
        {label}
      </label>
      {onBack !== undefined && (
        <button type="button" className={styles.backButton} aria-label="뒤로 가기" onClick={onBack}>
          <Icon name="arrow-left" size={18} />
        </button>
      )}
      <input
        ref={inputRef}
        id={inputId}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        enterKeyHint="search"
        autoFocus={autoFocus}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.nativeEvent.isComposing) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      />

      {/* 돋보기와 x는 같은 오른쪽 한 자리(44px)를 나눠 쓴다. 글자가 없으면 돋보기(검색), 있으면 x(지우기)로 바뀐다.
          자리는 절대 위치라 입력 칸 폭과 글자 시작 위치는 어떤 상태에서도 움직이지 않는다. x는 마우스와 터치로만 누르고 Tab 순서 밖이다. */}
      {hasValue ? (
        <button
          key="clear"
          className={styles.slot}
          data-role="clear"
          type="button"
          tabIndex={-1}
          aria-label="검색어 지우기"
          disabled={disabled}
          onClick={clear}
        >
          {/* 다방처럼 옅은 회색 동그라미 안에 x. */}
          <span className={styles.clearIcon}>
            <Icon name="close" size={11} />
          </span>
        </button>
      ) : (
        <button
          key="search"
          className={styles.slot}
          data-role="submit"
          type={renderAsForm ? 'submit' : 'button'}
          aria-label="검색"
          disabled={disabled}
          onClick={renderAsForm ? undefined : onSubmit}
        >
          <Icon name="search" size={20} />
          {showSubmitButton && <span className={styles.srOnly}>검색</span>}
        </button>
      )}
    </>
  );

  const classNames = `${styles.search} ${shape === 'pill' ? styles.pill : ''} ${className ?? ''}`;
  if (renderAsForm) {
    return (
      <form className={classNames} role="search" onSubmit={submit}>
        {fieldContent}
      </form>
    );
  }

  return (
    <div
      className={classNames}
      role="search"

      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          event.target instanceof HTMLInputElement &&
          !event.nativeEvent.isComposing &&
          !disabled
        ) {
          event.preventDefault();
          onSubmit();
        }
      }}
    >
      {fieldContent}
    </div>
  );
};

const styles = {
  search: css`
    label: SearchField-search;
    position: relative;
    box-shadow: none !important;
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    margin: 0;
    border: 1px solid #ededed;
    border-radius: 10px;
    background: var(--color-surface);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    /* 입력할 때 테두리를 검게 바꾸지 않는다. 포커스 링은 입력칸이 아니라 검색창 모양을 따라 둥글게 그린다. */
    &:focus-within {
      border-color: var(--color-brand-blue-ink);
    }

    & input {
      flex: 1;
      width: 100%;
      min-width: 0;
      min-height: 2.4rem;
      /* 다방 검색창처럼 왼쪽 여백은 일반 값(16px)이고 항상 같다. 글자와 커서는 포커스, 입력, 한글 조합, 아이콘 전환 중에도 움직이지 않는다.
         오른쪽 2.9rem은 아이콘 자리(44px) 몫이다. */
      padding: 0.55rem 2.9rem 0.55rem 1rem;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--color-ink);
      font: inherit;
      font-size: 0.95rem;
    }

    /* 전역 input:focus-visible 윤곽선은 검색창 안에서 네모난 테두리로 보여 끈다. */
    & input:focus-visible {
      outline: 0;
    }

    & input::placeholder {
      color: var(--color-placeholder);
    }
  `,

  pill: css`
    label: SearchField-pill;
    /* 알약이 아니라 약간만 둥글게. */
    border-radius: 10px;
  `,

  backButton: css`
    label: SearchField-backButton;
    display: grid;
    width: 2.35rem;
    height: 2.35rem;
    margin-left: 0.25rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    cursor: pointer;
    place-items: center;
  `,

  /* 아이폰 입력창의 지우기 버튼처럼 옅은 회색 동그라미에 흰 x. */
  clearIcon: css`
    label: SearchField-clearIcon;
    display: grid;
    width: 1.25rem;
    height: 1.25rem;
    place-items: center;
    border-radius: 50%;
    background: #ededed;
    color: #333;
  `,

  /* 돋보기와 x가 번갈아 놓이는 오른쪽 한 자리. 입력 칸 안쪽 오른쪽 끝에 고정한다. */
  slot: css`
    label: SearchField-slot;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 2.75rem;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
  `,

  srOnly: css`
    label: SearchField-srOnly;
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `,
};

export default SearchField;
