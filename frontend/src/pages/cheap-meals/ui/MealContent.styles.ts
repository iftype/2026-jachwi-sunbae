import { css } from '@emotion/css';

export const section = css`
  label: MealContent-section;
  padding: 1.4rem 1.25rem 2rem;
  max-width: 45rem;
  margin: auto;
  & h2 {
    margin: 0 0 0.5rem;
    font-size: 1.35rem;
    letter-spacing: -0.035em;
  }
  & p {
    line-height: 1.6;
  }
`;
/* 데스크탑은 본문 칸을 넓게 쓰고, 좌우 여백은 화면 쪽에서 준다. */
export const sectionDesktop = css`
  label: MealContent-sectionDesktop;
  max-width: none;
  padding: 0 0 1.5rem;
  & h2 {
    font-size: 1.1rem;
  }
`;
export const description = css`
  label: MealContent-description;
  color: var(--color-ink-soft);
  font-size: 0.85rem;
  margin: 0 0 1.25rem;
`;
export const sourceLink = css`
  label: MealContent-sourceLink;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-primary);
  font-size: 0.8rem;
  text-underline-offset: 0.2em;
`;
export const badge = css`
  label: MealContent-badge;
  display: inline-flex;
  width: fit-content;
  padding: 0.3rem 0.6rem;
  border-radius: 0.4rem;
  font-size: 0.75rem;
  font-weight: 800;
  background: color-mix(in srgb, var(--color-brand-yellow) 24%, var(--color-surface));
  color: var(--color-ink);
`;
