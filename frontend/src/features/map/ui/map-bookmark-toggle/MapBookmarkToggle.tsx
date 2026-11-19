import { css } from '@emotion/css';

import {
  DESKTOP_MAP_CONTROLS_RIGHT,
  DESKTOP_MAP_CONTROLS_TOP,
  MOBILE_MAP_CONTROLS_RIGHT,
  MOBILE_MAP_CONTROLS_TOP,
} from '../../lib/mapControlsLayout';
import type { MapCanvasProps } from '../../model/MapCanvas';

const MapBookmarkToggle = ({
  count,
  isOn,
  isDisabled = false,
  onToggle,
}: NonNullable<MapCanvasProps['bookmarkControl']>) => {
  const label = count === 0 ? '찜한 동네가 없어요' : `찜한 동네 ${isOn ? '숨기기' : '보기'}, ${count}곳`;
  return (
    <button
      className={styles.button}
      type="button"
      aria-pressed={isOn}
      disabled={isDisabled}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24">
        <path
          d="M2.8 8.1 8 5.5 11.1 2.8 15.2 4.9 20.4 5.2 21.3 10.1 18.6 12.7 19.1 17.4 14.2 20.8 9.9 19.5 5.1 21 4.8 16.5 2.6 13.3Z"
          fill="currentColor"
          fillOpacity={isOn ? 0.32 : 0.12}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m8 5.5 2.4 4.6-1.2 5.2 0.7 4.2m0.5-9.4 8.2 2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span aria-hidden="true">찜</span>
      {count > 0 && (
        <span className={styles.count} aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
};

const styles = {
  /* 지도 칸(공유 지도의 포털 대상, absolute inset 0) 안쪽 기준이다. 뷰포트 기준(fixed)이면 칸이 화면 오른쪽에 딱 붙지 않을 때 확대 축소 열 밖으로 튀어나간다. */
  button: css`
    label: MapBookmarkToggle-button;
    position: absolute;
    z-index: 32;
    top: ${DESKTOP_MAP_CONTROLS_TOP};
    right: ${DESKTOP_MAP_CONTROLS_RIGHT};
    display: grid;
    place-content: center;
    justify-items: center;
    width: 2.65rem;
    height: 2.65rem;
    gap: 0.05rem;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    background: var(--color-canvas);
    color: var(--color-ink-soft);
    box-shadow: var(--shadow-floating);
    font: inherit;
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1;
    cursor: pointer;

    &[aria-pressed='true'] {
      border-color: var(--color-brand-blue-ink);
      color: var(--color-brand-blue-ink);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }

    @media (max-width: 1023px) {
      top: ${MOBILE_MAP_CONTROLS_TOP};
      right: ${MOBILE_MAP_CONTROLS_RIGHT};
    }
  `,
  count: css`
    position: absolute;
    top: -0.25rem;
    right: -0.25rem;
    min-width: 1.1rem;
    padding: 0.2rem;
    border-radius: 999px;
    background: var(--color-brand-blue-ink);
    color: white;
    font-size: 0.65rem;
  `,
};

export default MapBookmarkToggle;
