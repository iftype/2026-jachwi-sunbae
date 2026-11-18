import { css } from '@emotion/css';

import Icon from '../icon/Icon';

type Props = { value: 'list' | 'map'; onChange: (view: 'list' | 'map') => void; label: string };
const MapViewSwitch = ({ value, onChange, label }: Props) => (
  <div className={styles.position}>
    <nav className={styles.switch} aria-label={label}>
      <button type="button" aria-pressed={value === 'list'} onClick={() => onChange('list')}>
        <Icon name="checklist" size={17} /> 리스트
      </button>
      <button type="button" aria-pressed={value === 'map'} onClick={() => onChange('map')}>
        <Icon name="map" size={17} /> 지도
      </button>
    </nav>
  </div>
);
const styles = {
  position: css`
    label: MapViewSwitch-position;
    position: fixed;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom) + 0.75rem);
    transform: translateX(-50%);
    z-index: 20;
    pointer-events: auto;
  `,
  switch: css`
    label: MapViewSwitch-root;
    display: flex;
    padding: 0.3rem;
    border: 1px solid var(--color-border);
    border-radius: 2rem;
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
    & button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      min-width: 5.1rem;
      padding: 0.6rem 0.7rem;
      border: 0;
      border-radius: 1.5rem;
      color: var(--color-muted);
      background: transparent;
      font: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    & button[aria-pressed='true'] {
      color: var(--color-surface);
      background: var(--color-ink);
    }
  `,
};
export default MapViewSwitch;
