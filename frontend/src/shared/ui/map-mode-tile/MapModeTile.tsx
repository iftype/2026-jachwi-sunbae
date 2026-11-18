import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import Icon from '../icon/Icon';

type Props = { mode: 'records' | 'neighborhoods'; to?: string; onClick?: () => void };
const MapModeTile = ({ mode, to, onClick }: Props) => {
  const label = mode === 'records' ? '내 기록' : '동네 찾기';
  const ariaLabel = mode === 'records' ? '기록으로 전환' : '동네 찾기로 전환';
  const content = (
    <>
      <Icon name={mode === 'records' ? 'home' : 'map'} size={20} />
      <span>{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={tile} aria-label={ariaLabel}>
      {content}
    </Link>
  ) : (
    <button type="button" className={tile} aria-label={ariaLabel} onClick={onClick}>
      {content}
    </button>
  );
};
const tile = css`
  label: MapModeTile-root;
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-brand-blue-ink);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-floating);
  font: inherit;
  font-size: 0.65rem;
  letter-spacing: -0.04em;
  line-height: 1.15;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 3px;
  }
`;
export default MapModeTile;
