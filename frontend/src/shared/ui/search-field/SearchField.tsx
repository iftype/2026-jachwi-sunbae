import type { FormEvent } from 'react';
import { useId } from 'react';

import Icon from '../icon/Icon';

import styles from './SearchField.module.css';

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
      {onBack !== undefined ? (
        <button type="button" className={styles.backButton} aria-label="뒤로 가기" onClick={onBack}>
          <Icon name="arrow-left" size={18} />
        </button>
      ) : (
        <Icon name="search" size={18} className={styles.searchIcon} />
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
          <Icon name="close" size={17} />
        </button>
      )}
      {showSubmitButton && (
        <button
          className={styles.submit}
          type={renderAsForm ? 'submit' : 'button'}
          disabled={disabled}
          onClick={renderAsForm ? undefined : onSubmit}
        >
          검색
        </button>
      )}
    </>
  );

  const classNames = `${styles.search} ${shape === 'pill' ? styles.pill : ''} ${showSubmitButton ? '' : styles.withoutSubmit} ${className ?? ''}`;
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

export default SearchField;
