import { css } from '@emotion/css';
import type { KeyboardEventHandler, PointerEventHandler, ReactNode, Ref } from 'react';

type ChecklistItemRowProps = {
  itemKey: string;
  question: string;
  guide?: string | null;
  originLabel?: string;
  inactiveNote?: string;
  isDisabled?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  dragHandleLabel: string;
  removeLabel?: string;
  contentRef?: Ref<HTMLElement>;
  onDragHandleKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  onRemove?: () => void;
  dragHandleProps?: {
    onPointerDown?: PointerEventHandler<HTMLButtonElement>;
    onPointerMove?: PointerEventHandler<HTMLButtonElement>;
    onPointerUp?: PointerEventHandler<HTMLButtonElement>;
    onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
  };
  trailing?: ReactNode;
};

/** 체크리스트 항목의 표시 구조만 담당한다. 순서 변경·삭제 같은 동작은 바깥 기능 컴포넌트가 주입한다. */
const ChecklistItemRow = ({
  itemKey,
  question,
  guide,
  originLabel,
  inactiveNote,
  isDisabled = false,
  isDragging = false,
  isDragOver = false,
  dragHandleLabel,
  removeLabel,
  contentRef,
  onDragHandleKeyDown,
  onRemove,
  dragHandleProps,
  trailing,
}: ChecklistItemRowProps) => (
  <li
    className={styles.item}
    data-editor-item-key={itemKey}
    data-dragging={isDragging || undefined}
    data-drag-over={isDragOver || undefined}
  >
    <button
      type="button"
      className={styles.dragHandle}
      disabled={isDisabled}
      aria-label={dragHandleLabel}
      onKeyDown={onDragHandleKeyDown}
      {...dragHandleProps}
    >
      <span aria-hidden="true">≡</span>
    </button>
    <div className={styles.copy}>
      {originLabel !== undefined && <span className="sr-only">{originLabel}</span>}
      <strong ref={contentRef} tabIndex={-1}>
        {question}
      </strong>
      {guide !== undefined && guide !== null && <small>{guide}</small>}
      {inactiveNote !== undefined && <small className={styles.inactiveNote}>{inactiveNote}</small>}
    </div>
    {(onRemove !== undefined || trailing !== undefined) && (
      <span className={styles.actions}>
        {trailing}
        {onRemove !== undefined && (
          <button
            type="button"
            className={styles.removeButton}
            disabled={isDisabled}
            aria-label={removeLabel ?? `${question} 제거`}
            onClick={onRemove}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </span>
    )}
  </li>
);

const styles = {
  item: css`
    label: ChecklistItemRow-item;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    min-height: 3.5rem;
    padding: 0.55rem 0.65rem;
    border: 0;
    border-radius: 1rem;
    background: var(--color-card-surface);

    &[data-dragging='true'] {
      opacity: 0.55;
    }

    &[data-drag-over='true'] {
      outline: 2px solid var(--color-primary);
      background: var(--color-surface-brand);
    }
  `,

  dragHandle: css`
    label: ChecklistItemRow-dragHandle;
    display: grid;
    width: 1.6rem;
    min-width: 1.6rem;
    min-height: 2.25rem;
    padding: 0;
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--color-muted);
    font: inherit;
    font-size: 1.15rem;
    cursor: grab;
    place-items: center;
    touch-action: none;

    &:active {
      cursor: grabbing;
    }

    &:focus-visible {
      border-radius: 0.35rem;
      outline: 2px solid var(--color-focus);
      outline-offset: 1px;
    }
  `,

  copy: css`
    label: ChecklistItemRow-copy;
    min-width: 0;

    & strong,
    & small {
      display: block;
      overflow-wrap: anywhere;
    }

    & strong {
      font-size: 0.78rem;
      line-height: 1.45;
    }

    & small {
      margin-top: 0.2rem;
      color: var(--color-muted);
      font-size: 0.7rem;
    }
  `,

  inactiveNote: css`
    label: ChecklistItemRow-inactiveNote;
    color: var(--color-error);
    font-weight: 600;
  `,

  actions: css`
    label: ChecklistItemRow-actions;
    display: flex;
    gap: 0.2rem;
  `,

  removeButton: css`
    label: ChecklistItemRow-removeButton;
    min-width: 1.75rem;
    min-height: 2.25rem;
    padding: 0;
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--color-error);
    font: inherit;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.35;
    }
  `,
};

export default ChecklistItemRow;
