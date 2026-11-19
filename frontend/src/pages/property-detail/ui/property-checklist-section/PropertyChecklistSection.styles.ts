import { css, keyframes } from '@emotion/css';

export const retry = css`
  label: PropertyChecklistSection-retry;
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  margin: 0;
  border: 0;
  border-radius: 1rem;
  background: var(--color-card-surface);
  color: var(--color-muted);
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
`;

export const mainAction = css`
  label: PropertyChecklistSection-mainAction;
  gap: 0.4rem;
  margin-top: 0.9rem;
`;

const shimmerKeyframes = keyframes`
  to {
    background-position: -200% 0;
  }
`;

export const skeleton = css`
  label: PropertyChecklistSection-skeleton;
  display: block;
  height: 0.8rem;
  border-radius: 999px;
  /* 흰 카드 위에서 보이도록 옅은 회색 두 단계로 반짝인다. */
  background: linear-gradient(90deg, #f1f2f4 25%, #e5e7ea 50%, #f1f2f4 75%);
  background-size: 200% 100%;
  animation: ${shimmerKeyframes} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/* 진행 링(ChecklistProgressRing)과 같은 크기와 간격으로 둔다. */
export const skeletonSummary = css`
  label: PropertyChecklistSection-skeletonSummary;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-top: 0.9rem;
`;

/* 카드들을 회색 바탕 위에 간격을 두고 쌓는다(실제 화면과 같은 0.5rem). */
export const skeletonStack = css`
  label: PropertyChecklistSection-skeletonStack;
  display: grid;
  gap: 0.5rem;
`;

export const skeletonCard = css`
  label: PropertyChecklistSection-skeletonCard;
  padding: 0.95rem 1rem 1rem;
  background: var(--color-canvas);
`;

export const skeletonCategory = css`
  label: PropertyChecklistSection-skeletonCategory;
  width: 30%;
  height: 0.95rem;
  margin-bottom: 0.3rem;
`;

export const skeletonRing = css`
  label: PropertyChecklistSection-skeletonRing;
  flex: 0 0 auto;
  width: 76px;
  height: 76px;
`;

export const skeletonLegend = css`
  label: PropertyChecklistSection-skeletonLegend;
  display: grid;
  width: 6rem;
  gap: 0.6rem;
`;

export const skeletonTitle = css`
  label: PropertyChecklistSection-skeletonTitle;
  width: 45%;
  height: 1.05rem;
  margin-bottom: 0.4rem;
`;

export const skeletonItems = css`
  label: PropertyChecklistSection-skeletonItems;
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;

  & li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 3.6rem;
  }

  & li > span:first-child {
    flex: 1 1 auto;
    max-width: 60%;
  }
`;

export const skeletonAction = css`
  label: PropertyChecklistSection-skeletonAction;
  flex: 0 0 auto;
  width: 8.5rem;
  height: 2.4rem;
  border-radius: var(--radius-sm);
`;

export const skeletonPlaceholder = css`
  label: PropertyChecklistSection-skeletonPlaceholder;
  visibility: hidden;
`;
