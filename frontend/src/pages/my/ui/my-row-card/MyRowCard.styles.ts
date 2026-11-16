import { css } from '@emotion/css';

export const notice = css`
  label: MyRowCard-notice;
  display: grid;
  width: 100%;
  border: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.25rem;
  padding: 0.55rem var(--my-card-padding);
  border-radius: 0;
  background: transparent;
  /* 개인정보, 탈퇴 같은 계정 관리 줄은 눈에 덜 띄게 회색으로 둔다. */
  color: var(--color-ink-soft);
  text-decoration: none;

  & span,
  & strong {
    display: block;
  }

  & strong {
    font-size: var(--my-text-size, 0.95rem);
    letter-spacing: -0.02em;
  }

  /* 줄 끝 화살표: 크고 두꺼운 회색. */
  & > svg:last-child {
    flex: none;
    width: var(--my-chevron-size);
    height: var(--my-chevron-size);
    color: var(--my-chevron-color);
    stroke-width: 2.6;
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }
`;
