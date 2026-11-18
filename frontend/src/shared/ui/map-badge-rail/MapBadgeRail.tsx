import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import Icon from '../icon/Icon';

type Item = { id: string; label: string; value?: string | number; valueColor?: string };
type Props = {
  items: Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  label: string;
  overMap?: boolean;
  desktopMap?: boolean;
  className?: string;
};

const MapBadgeRail = ({ items, selectedId, onSelect, label, overMap, desktopMap, className }: Props) => {
  const rail = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ before: false, after: false });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () =>
      setEdges({
        before: element.scrollLeft > 1,
        after: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      });
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener('resize', update);
    return () => {
      element.removeEventListener('scroll', update);
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [items]);
  const scroll = (direction: -1 | 1) => {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.75, behavior: 'smooth' });
  };
  return (
    <div className={`${styles.root} ${className ?? ''}`} data-desktop-map={desktopMap || undefined}>
      <nav
        ref={rail}
        className={styles.rail}
        aria-label={label}
        data-over-map={overMap || undefined}
        onWheel={(event) => {
          event.stopPropagation();
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY;
        }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (event.pointerType === 'mouse' && event.button === 0)
            drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const delta = event.clientX - start.x;
          if (!start.moved && Math.abs(delta) < 5) return;
          start.moved = true;
          suppressClick.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.scrollLeft = start.scroll - delta;
        }}
        onPointerUp={(event) => {
          drag.current = null;
          // 포인터 캡처를 지원하지 않는 환경(일부 웹뷰, jsdom)에서도 손을 뗄 때 오류 없이 끝낸다.
          if ('hasPointerCapture' in event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          window.setTimeout(() => {
            suppressClick.current = false;
          }, 0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          suppressClick.current = false;
        }}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {items.map((item) => (
          <button key={item.id} type="button" aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>
            {item.label}
            {item.value !== undefined && (
              <span data-colored={Boolean(item.valueColor) || undefined} style={{ color: item.valueColor }}>
                {item.value}
              </span>
            )}
          </button>
        ))}
      </nav>
      {desktopMap && edges.before && (
        <button
          className={`${styles.arrow} ${styles.before}`}
          aria-label={`${label} 이전 보기`}
          onClick={() => scroll(-1)}
        >
          <Icon name="chevron-left" size={18} />
        </button>
      )}
      {desktopMap && edges.after && (
        <button
          className={`${styles.arrow} ${styles.after}`}
          aria-label={`${label} 다음 보기`}
          onClick={() => scroll(1)}
        >
          <Icon name="chevron-right" size={18} />
        </button>
      )}
    </div>
  );
};
const styles = {
  root: css`
    label: MapBadgeRail-root;
    position: relative;
    min-width: 0;
    flex-shrink: 0;
    &[data-desktop-map='true'] {
      position: absolute;
      z-index: 31;
      top: 1rem;
      left: calc(var(--map-panel-width, 0px) + 0.5rem);
      right: 4rem;
      padding-top: 0.75rem;
    }
  `,
  rail: css`
    label: MapBadgeRail-rail;
    display: flex;
    gap: 0.5rem;
    min-width: 0;
    overflow-x: auto;
    overscroll-behavior: contain;
    touch-action: pan-x;
    padding: 0.6rem 1rem 0.85rem;
    scrollbar-width: none;
    user-select: none;
    &::-webkit-scrollbar {
      display: none;
    }
    & button {
      flex-shrink: 0;
      padding: 0.65rem 1rem;
      border: 0;
      border-radius: 1.5rem;
      background: var(--color-surface-muted);
      color: var(--color-muted);
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
    }
    & span {
      margin-left: 0.4rem;
      font-weight: 700;
      opacity: 0.7;
    }
    & span[data-colored='true'] {
      opacity: 1;
      background: var(--color-surface);
      border-radius: var(--radius-sm);
      padding: 0.1rem 0.2rem;
    }
    & button[aria-pressed='true'] {
      background: var(--color-brand-blue-ink);
      color: var(--color-surface);
    }
    &[data-over-map='true'] button:not([aria-pressed='true']) {
      background: var(--color-surface);
      box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
    }
    & button:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
    }
    @media (min-width: 768px) {
      padding-right: 1.5rem;
      padding-left: 1.5rem;
      & button {
        font-size: 0.92rem;
      }
    }
  `,
  arrow: css`
    label: MapBadgeRail-arrow;
    position: absolute;
    top: 50%;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-ink);
    box-shadow: var(--shadow-floating);
    cursor: pointer;
    transform: translateY(-50%);
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
  before: css`
    label: MapBadgeRail-before;
    left: 0;
  `,
  after: css`
    label: MapBadgeRail-after;
    right: 0;
  `,
};
export default MapBadgeRail;
