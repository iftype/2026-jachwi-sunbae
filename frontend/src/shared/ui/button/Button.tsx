import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import type { LinkProps } from 'react-router-dom';
import { Link } from 'react-router-dom';

import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'soft' | 'secondary' | 'neutral' | 'danger' | 'text';

export type ButtonSize = 'medium' | 'large';

type SharedButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  /** `large`는 높이 52px·글자 18px로, 로그인처럼 화면의 주 행동 버튼에 쓴다. */
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> &
  SharedButtonProps & {
    ref?: Ref<HTMLButtonElement>;
    isLoading?: boolean;
    loadingLabel?: string;
  };

type ButtonLinkProps = Omit<LinkProps, 'children'> & SharedButtonProps;

const buttonClassName = (variant: ButtonVariant, size: ButtonSize, fullWidth: boolean, className: string | undefined) =>
  [
    styles.button,
    styles[variant],
    size === 'large' ? styles.large : '',
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

export const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  className,
  isLoading = false,
  loadingLabel = '처리 중…',
  disabled,
  type = 'button',
  ref,
  ...buttonProps
}: ButtonProps) => (
  <button
    {...buttonProps}
    ref={ref}
    className={buttonClassName(variant, size, fullWidth, className)}
    type={type}
    disabled={disabled === true || isLoading}
    aria-busy={isLoading || undefined}
  >
    {isLoading && <span className={styles.spinner} aria-hidden="true" />}
    <span>{isLoading ? loadingLabel : children}</span>
  </button>
);

export const ButtonLink = ({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  className,
  ...linkProps
}: ButtonLinkProps) => (
  <Link {...linkProps} className={buttonClassName(variant, size, fullWidth, className)}>
    {children}
  </Link>
);
