import { css } from '@emotion/css';

/** 계정, 도구, 서비스 설정이 같은 여백과 글자 크기를 사용한다. */
export const page = css`
  label: MyPage-page;
  --my-card-padding: 0.75rem;
  --my-text-size: 0.9rem;
  --my-subtext-size: 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--color-canvas);
`;

export const footer = css`
  label: MyPage-footer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-placeholder);
  font-size: 0.66rem;
`;
