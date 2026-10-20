import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

import styles from './TextField.module.css';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & {
  label: string;
  requirement?: '필수' | '선택';
  helpText?: string;
  error?: string;
  suffix?: ReactNode;
  labelSuffix?: ReactNode;
  fieldClassName?: string;
  /** 기본은 회색 채움형 `filled`. 예전 밑줄 모양은 `underline`, 네모 테두리는 `box`로 쓴다. */
  variant?: 'box' | 'underline' | 'filled';
  /** 한 화면에서 한 칸씩 크게 묻는 폼은 `large`를 쓴다. */
  fieldSize?: 'medium' | 'large';
  /**
   * 입력 전에는 placeholder를 보여주고, 포커스하거나 값이 있으면 라벨을 위로 띄운다.
   * 채움형은 라벨을 칸 위에 고정해 두므로 이 값을 쓰지 않는다.
   */
  floatingLabel?: boolean;
};

const TextField = ({
  label,
  requirement,
  helpText,
  error,
  suffix,
  labelSuffix,
  id,
  className,
  fieldClassName,
  variant = 'filled',
  fieldSize = 'medium',
  floatingLabel = false,
  ...inputProps
}: TextFieldProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpId = helpText === undefined ? undefined : `${inputId}-help`;
  const errorId = error === undefined ? undefined : `${inputId}-error`;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const usesFloatingLabel = floatingLabel && variant !== 'filled';

  const labelContent = (
    <>
      {requirement === '필수' && (
        <span className={styles.requiredMarker} aria-hidden="true">
          *
        </span>
      )}
      {label}
      {labelSuffix}
    </>
  );

  return (
    <div
      className={`${styles.field} ${fieldClassName ?? ''}`}
      data-variant={variant}
      data-size={fieldSize}
      data-floating-label={usesFloatingLabel || undefined}
    >
      {!usesFloatingLabel && <label htmlFor={inputId}>{labelContent}</label>}
      <div className={styles.control}>
        {usesFloatingLabel && (
          <label className={styles.floatingLabel} htmlFor={inputId}>
            {labelContent}
          </label>
        )}
        <input
          {...inputProps}
          id={inputId}
          className={className}
          aria-label={inputProps['aria-label'] ?? label}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
        />
        {suffix !== undefined && <span className={styles.suffix}>{suffix}</span>}
      </div>
      {helpText !== undefined && (
        <p id={helpId} className={styles.help}>
          {helpText}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default TextField;
