import { css } from '@emotion/css';

import iconProfile from '@/shared/assets/icon-profile.webp';

type Props = { size?: number; label?: string };
const IdentityPlaceholder = ({ size = 44, label }: Props) => (
  <span
    className={root}
    style={{ width: size, height: size }}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    {/* 기본 회색 사람 그림 대신 우리가 만든 프로필 그림을 쓴다. */}
    <img src={iconProfile} alt="" width={size} height={size} />
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
  & img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;
export default IdentityPlaceholder;
