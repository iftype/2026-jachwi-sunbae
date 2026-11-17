import { css } from '@emotion/css';

export const state = css`
  label: PropertyMemoSection-state;
  display: flex;
  width: 100%;
  min-height: 3.5rem;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0.75rem 0;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: 0.76rem;
`;

export const retry = css`
  label: PropertyMemoSection-retry;
  display: flex;
  width: 100%;
  min-height: 3.5rem;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0.75rem 0;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: 0.76rem;
  cursor: pointer;
`;

export const field = css`
  label: PropertyMemoSection-field;
  display: block;
  width: 100%;
  min-height: 3rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-ink-soft);
  font: inherit;
  font-size: 0.78rem;
  line-height: 1.5;
  text-align: left;
  /* 엔터로 넣은 줄바꿈과 연속 공백을 입력한 그대로 보여 주고, 긴 URL은 칸 안에서 접는다. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: text;

  /* 올리면 목록 호버와 같은 옅은 파랑으로 바꿔 누를 수 있음을 알린다. 흰색으로 바꾸면 칸이 사라진 것처럼 보인다. */
  &:hover {
    background: color-mix(in srgb, var(--color-brand-blue) 7%, #fff);
  }
`;

export const editor = css`
  label: PropertyMemoSection-editor;
  display: block;
  width: 100%;
  min-height: 7.5rem;
  box-sizing: border-box;
  resize: vertical;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-ink);
  font: inherit;
  font-size: 0.78rem;
  line-height: 1.5;

  &:focus,
  &:focus-visible {
    border-color: var(--color-primary);
    background: var(--color-surface);
    outline: 0;
  }
`;

export const error = css`
  label: PropertyMemoSection-error;
  margin: 0;
  color: var(--color-danger);
  font-size: 0.7rem;
`;
