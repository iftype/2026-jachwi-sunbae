import { css } from '@emotion/css';

export const notice = css`
  label: MyRowCard-notice;
  display: grid;
  width: 100%;
  border: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.4rem var(--my-card-padding);
  border-radius: 0;
  background: transparent;
  color: var(--color-error);
  text-decoration: none;

  & span,
  & strong,
  & small {
    display: block;
  }

  & strong {
    font-size: var(--my-text-size, 0.95rem);
    letter-spacing: -0.02em;
  }

  & small {
    margin-top: 0.1rem;
    word-break: keep-all;
    color: color-mix(in srgb, var(--color-error) 70%, var(--color-muted));
    font-size: var(--my-subtext-size, 0.78rem);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }
`;

export const noticeIcon = css`
  label: MyRowCard-noticeIcon;
  display: grid;
  place-items: center;
`;
