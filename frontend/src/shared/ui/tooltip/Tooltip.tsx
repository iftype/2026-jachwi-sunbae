import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

type Props = {
  children: ReactNode;
  content?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
};
const Tooltip = ({ children, content, placement = 'top', className }: Props) => {
  const [isOpen, setIsOpen] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!isOpen || !content) return;
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
  }, [isOpen, content]);
  return (
    <div ref={root} className={`${styles.root} ${className ?? ''}`}>
      <div aria-describedby={isOpen && content ? id : undefined} onClick={() => setIsOpen(false)}>
        {children}
      </div>
      {isOpen && content && (
        <div id={id} role="tooltip" className={styles.content} data-placement={placement}>
          {content}
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
    max-width: min(17.5rem, calc(100vw - 2rem));
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-brand-blue-ink) 20%, transparent);
    color: var(--color-brand-blue-ink);
    box-shadow: var(--shadow-floating);
    font-size: 0.75rem;
    line-height: 1.5;
    text-align: center;
    overflow-wrap: anywhere;
    &[data-placement='top'] {
      bottom: calc(100% + 0.75rem);
      left: 50%;
      transform: translateX(-50%);
    }
    &[data-placement='bottom'] {
      top: calc(100% + 0.75rem);
      left: 50%;
      transform: translateX(-50%);
    }
    &[data-placement='left'] {
      right: calc(100% + 0.75rem);
      top: 50%;
      transform: translateY(-50%);
    }
    &[data-placement='right'] {
      left: calc(100% + 0.75rem);
      top: 50%;
      transform: translateY(-50%);
    }
  `,
  arrow: css`
    label: Tooltip-arrow;
    position: absolute;
    width: 0.6rem;
    height: 0.6rem;
    background: inherit;
    transform: rotate(45deg);
    [data-placement='top'] > & {
      bottom: -0.25rem;
      left: calc(50% - 0.3rem);
    }
    [data-placement='bottom'] > & {
      top: -0.25rem;
      left: calc(50% - 0.3rem);
    }
    [data-placement='left'] > & {
      right: -0.25rem;
      top: calc(50% - 0.3rem);
    }
    [data-placement='right'] > & {
      left: -0.25rem;
      top: calc(50% - 0.3rem);
    }
  `,
};
export default Tooltip;
