import { css } from '@emotion/css';

type Props = { size?: number; label?: string };
const IdentityPlaceholder = ({ size = 44, label }: Props) => (
  <span
    className={root}
    style={{ width: size, height: size }}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="14" r="7" />
      <path d="M6 37a14 14 0 0 1 28 0Z" />
    </svg>
  </span>
);
const root = css`
  label: IdentityPlaceholder-root;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-brand-blue-ink) 12%, var(--color-surface));
  color: var(--color-brand-blue-ink);
  & svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
`;
export default IdentityPlaceholder;
