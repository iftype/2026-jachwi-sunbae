import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import Icon from '../icon/Icon';

import styles from './BottomSheet.module.css';

type BottomSheetProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  showCloseButton?: boolean;
};

const BottomSheet = ({
  title,
  children,
  onClose,
  closeLabel = '상세 닫기',
  showCloseButton = true,
}: BottomSheetProps) => {
  const [height, setHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const gesture = useRef<{ startY: number; height: number; limit: number } | null>(null);
  const dragged = useRef(false);
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (showCloseButton ? closeButtonRef.current : handleRef.current)?.focus({ preventScroll: true });
  }, [showCloseButton]);
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current;
    gesture.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!start || !dragged.current) return;
    const released = start.height + start.startY - event.clientY;
    if (released < start.limit * 0.25) onClose();
    else setExpanded(released > start.limit * 0.7);
    setHeight(null);
  };
  return (
    <section
      ref={sheetRef}
      className={styles.sheet}
      aria-label={title}
      data-expanded={expanded || undefined}
      style={height === null ? undefined : ({ '--sheet-height': `${height}px` } as CSSProperties)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <button
        ref={handleRef}
        className={styles.grabber}
        type="button"
        aria-label="상세 패널 높이 조절"
        aria-expanded={expanded}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragged.current = false;
          const sheet = sheetRef.current;
          if (!sheet) return;
          gesture.current = {
            startY: event.clientY,
            height: sheet.getBoundingClientRect().height,
            limit: sheet.parentElement?.getBoundingClientRect().height ?? window.innerHeight,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start || Math.abs(event.clientY - start.startY) < 6) return;
          dragged.current = true;
          setHeight(Math.max(80, Math.min(start.limit * 0.9, start.height + start.startY - event.clientY)));
        }}
        onPointerUp={finish}
        onPointerCancel={(event) => {
          gesture.current = null;
          setHeight(null);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          setExpanded((value) => !value);
        }}
      >
        <span />
      </button>
      <header className={styles.header}>
        <h2>{title}</h2>
        {showCloseButton && (
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={closeLabel}>
            <Icon name="close" size={20} />
          </button>
        )}
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
};

export default BottomSheet;
