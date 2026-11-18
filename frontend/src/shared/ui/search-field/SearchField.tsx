import { css } from '@emotion/css';
import type { FormEvent } from 'react';
import { useId } from 'react';

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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disabled) onSubmit();
  };

  const clear = () => {
    onValueChange('');
    onClear?.();
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
      {/* 입력을 시작하면 오른쪽 돋보기가 오른쪽으로 빠지고, 왼쪽에 돋보기가 나타나 입력 중임을 보인다. 제출 버튼이 없는 검색창에서만 쓴다. */}
      {!showSubmitButton && (
        <span className={styles.typingIcon} data-role="typing-icon" aria-hidden="true">
          <Icon name="search" size={18} />
        </span>
      )}
      <input
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

      {value.length > 0 && (
        <button className={styles.clear} type="button" aria-label="검색어 지우기" disabled={disabled} onClick={clear}>
          {/* 아이폰 입력창처럼 회색 동그라미 안에 흰 x를 둔다. */}
          <span className={styles.clearIcon}>
            <Icon name="close" size={11} />
          </span>
        </button>
      )}
      <button
        className={styles.submit}
        data-role="submit"
        type={renderAsForm ? 'submit' : 'button'}
        aria-label="검색"
        disabled={disabled}
        onClick={renderAsForm ? undefined : onSubmit}
      >
        <Icon name="search" size={18} />
        {showSubmitButton && <span className={styles.srOnly}>검색</span>}
      </button>
    </>
  );

  const classNames = `${styles.search} ${shape === 'pill' ? styles.pill : ''} ${showSubmitButton ? '' : styles.withoutSubmit} ${className ?? ''}`;
  if (renderAsForm) {
    return (
      <form className={classNames} role="search" data-typing={value.length > 0} onSubmit={submit}>
        {fieldContent}
      </form>
    );
  }

  return (
    <div
      className={classNames}
      role="search"
      data-typing={value.length > 0}
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
    min-height: 2.5rem;
    align-items: center;
    margin: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    /* 입력할 때 테두리를 검게 바꾸지 않는다. 포커스 링은 입력칸이 아니라 검색창 모양을 따라 둥글게 그린다. */
    &:focus-within {
      border-color: color-mix(in srgb, var(--color-focus) 70%, transparent);
    }

    & input {
      flex: 1;
      width: 100%;
      min-width: 0;
      min-height: 2.4rem;
      padding: 0.55rem 0.85rem;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--color-ink);
      font: inherit;
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
    border-radius: 999px;
  `,

  withoutSubmit: css`
    label: SearchField-withoutSubmit;

    & input {
      transition: padding-left 0.18s ease;
    }
    & [data-role='submit'] {
      transition:
        transform 0.18s ease,
        opacity 0.18s ease,
        width 0.18s ease;
    }
    & [data-role='typing-icon'] {
      opacity: 0;
      transform: translateX(-0.5rem);
    }

    /* 입력 중: 오른쪽 돋보기는 오른쪽으로 사라지고, 왼쪽 돋보기가 나타난다. */
    &[data-typing='true'] [data-role='submit'] {
      opacity: 0;
      transform: translateX(1.5rem);
      pointer-events: none;
      /* 사라진 돋보기 자리를 비워, 지우기(X) 버튼이 오른쪽 끝으로 붙게 한다. */
      min-width: 0;
      width: 0;
      padding: 0;
    }
    &[data-typing='true'] [data-role='typing-icon'] {
      opacity: 1;
      transform: translateX(0);
    }
    &[data-typing='true'] input {
      padding-left: 2.4rem;
    }
  `,

  typingIcon: css`
    label: SearchField-typingIcon;
    position: absolute;
    top: 50%;
    left: 0.85rem;
    margin-top: -0.55rem;
    display: grid;
    place-items: center;
    color: var(--color-muted);
    pointer-events: none;
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
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

  clear: css`
    label: SearchField-clear;
    min-width: 2.75rem;
    min-height: 2.35rem;
    border: 0;
    background: transparent;
    cursor: pointer;
    display: grid;
    place-items: center;
  `,

  /* 아이폰 입력창의 지우기 버튼처럼 옅은 회색 동그라미에 흰 x. */
  clearIcon: css`
    label: SearchField-clearIcon;
    display: grid;
    width: 1.1rem;
    height: 1.1rem;
    place-items: center;
    border-radius: 50%;
    background: #c7c9ce;
    color: #fff;
  `,

  submit: css`
    label: SearchField-submit;
    min-width: 2.75rem;
    min-height: 2.35rem;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    cursor: pointer;
    display: grid;
    place-items: center;
    flex: none;
    padding: 0 0.75rem;
    font-weight: 800;
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
