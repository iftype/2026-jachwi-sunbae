import { useEffect, useId, useRef } from 'react';

import styles from './WheelPicker.module.css';

export type WheelPickerOption = { value: number; label: string };
type WheelPickerProps = {
  label: string;
  options: readonly WheelPickerOption[];
  value: number;
  onValueChange: (value: number) => void;
};
const ITEM_HEIGHT = 44;

const WheelPicker = ({ label, options, value, onValueChange }: WheelPickerProps) => {
  const id = useId();
  const column = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointerStart = useRef<number | undefined>(undefined);
  const wasDragged = useRef(false);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  useEffect(() => {
    if (column.current) column.current.scrollTop = selected * ITEM_HEIGHT;
  }, [selected]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const select = (index: number) => {
    clearTimeout(timer.current);
    const option = options[Math.max(0, Math.min(options.length - 1, index))];
    if (option) onValueChange(option.value);
  };
  return (
    <div
      className={styles.picker}
      role="listbox"
      aria-label={label}
      aria-activedescendant={options.length ? `${id}-${selected}` : undefined}
      tabIndex={0}
      onKeyDown={(event) => {
        const index = { ArrowDown: selected + 1, ArrowUp: selected - 1, Home: 0, End: options.length - 1 }[event.key];
        if (index !== undefined) {
          event.preventDefault();
          select(index);
        }
      }}
    >
      <div className={styles.indicator} aria-hidden="true" />
      <div
        ref={column}
        className={styles.column}
        onPointerDown={(event) => {
          pointerStart.current = event.clientY;
          wasDragged.current = false;
        }}
        onPointerMove={(event) => {
          if (pointerStart.current !== undefined && Math.abs(event.clientY - pointerStart.current) > 6)
            wasDragged.current = true;
        }}
        onPointerUp={() => {
          pointerStart.current = undefined;
        }}
        onPointerCancel={() => {
          pointerStart.current = undefined;
        }}
        onScroll={() => {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const index = Math.round((column.current?.scrollTop ?? 0) / ITEM_HEIGHT);
            if (index !== selected) select(index);
          }, 150);
        }}
      >
        {options.map((option, index) => (
          <div
            id={`${id}-${index}`}
            key={option.value}
            role="option"
            aria-selected={index === selected}
            className={styles.item}
            onClick={() => {
              if (!wasDragged.current) select(index);
            }}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
};
export default WheelPicker;
