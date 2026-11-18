import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

type TooltipAction = {
  /** 단계가 여럿이면 `다음`, 하나뿐이면 `확인`. */
  label: string;
  onClick: () => void;
};

type Props = {
  children: ReactNode;
  content?: ReactNode;
  /**
   * 있으면 안내 말풍선처럼 쓴다. 바깥을 누르거나 Esc를 눌러도 닫지 않고, 오른쪽의 이 버튼을 눌러야만 처리한다.
   * 열고 닫는 것은 쓰는 쪽이 정한다(`content`가 있으면 열린다).
   */
  action?: TooltipAction;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** 위아래 말풍선의 가로 정렬. 기본은 대상 가운데이고, `start`는 대상 왼쪽 끝에 맞춘다(좁은 칸 안에서 말풍선이 칸 밖으로 삐져나가지 않게). 꼬리는 `start`에서도 대상 쪽에 둔다. */
  align?: 'center' | 'start';
  className?: string;
};
const Tooltip = ({ children, content, action, placement = 'top', align = 'center', className }: Props) => {
  const [isOpen, setIsOpen] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!isOpen || !content || action) return;
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setIsOpen(false);
        return;
      }
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [isOpen, content, action]);
  return (
    <div ref={root} className={`${styles.root} ${className ?? ''}`}>
      <div aria-describedby={isOpen && content ? id : undefined} onClick={action ? undefined : () => setIsOpen(false)}>
        {children}
      </div>
      {isOpen && content && (
        <div id={id} role="tooltip" className={styles.content} data-placement={placement} data-align={align}>
          <span className={styles.message}>{content}</span>
          {action && (
            <button type="button" className={styles.action} onClick={action.onClick}>
              {action.label}
            </button>
          )}
          <span className={styles.arrow} />
        </div>
      )}
    </div>
  );
};
const styles = {
  root: css`
    label: Tooltip-root;
    position: relative;
    width: max-content;
    max-width: calc(100vw - 2rem);
  `,
  content: css`
    label: Tooltip-content;
    position: absolute;
    z-index: 90;
    width: max-content;
    max-width: min(20rem, calc(100vw - 2rem));
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-brand-blue-ink) 20%, transparent);
    color: var(--color-brand-blue-ink);
    box-shadow: var(--shadow-floating);
    font-size: 0.875rem;
    line-height: 1.55;
    text-align: center;
    overflow-wrap: anywhere;
    &:has(button) {
      display: flex;
      align-items: center;
      gap: 1rem;
      text-align: left;
      word-break: keep-all;
      box-shadow: 0 2px 10px rgb(0 0 0 / 14%);
    }
    &[data-placement='top'] {
      bottom: calc(100% + 0.9rem);
      left: 50%;
      transform: translateX(-50%);
    }
    &[data-placement='bottom'] {
      top: calc(100% + 0.9rem);
      left: 50%;
      transform: translateX(-50%);
    }
    &[data-align='start'][data-placement='top'],
    &[data-align='start'][data-placement='bottom'] {
      left: 0;
      transform: none;
    }
    &[data-placement='left'] {
      right: calc(100% + 0.9rem);
      top: 50%;
      transform: translateY(-50%);
    }
    &[data-placement='right'] {
      left: calc(100% + 0.9rem);
      top: 50%;
      transform: translateY(-50%);
    }
  `,
  message: css`
    label: Tooltip-message;
    font-weight: 600;
  `,
  action: css`
    label: Tooltip-action;
    flex: none;
    min-height: 2.25rem;
    padding: 0 1rem;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-brand-blue-ink) 10%, var(--color-surface));
    color: var(--color-brand-blue-ink);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 800;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
  arrow: css`
    label: Tooltip-arrow;
    position: absolute;
    width: 0.8rem;
    height: 0.8rem;
    background: inherit;
    transform: rotate(45deg);
    [data-placement='top'] > & {
      bottom: -0.35rem;
      left: calc(50% - 0.4rem);
    }
    [data-placement='bottom'] > & {
      top: -0.35rem;
      left: calc(50% - 0.4rem);
    }
    [data-align='start'][data-placement='top'] > &,
    [data-align='start'][data-placement='bottom'] > & {
      left: 1.25rem;
    }
    [data-placement='left'] > & {
      right: -0.35rem;
      top: calc(50% - 0.4rem);
    }
    [data-placement='right'] > & {
      left: -0.35rem;
      top: calc(50% - 0.4rem);
    }
  `,
};
export default Tooltip;
