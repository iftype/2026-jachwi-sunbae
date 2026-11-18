import { css } from '@emotion/css';

/** 계정, 도구, 서비스 설정이 같은 여백과 글자 크기를 사용한다. */
export const page = css`
  label: MyPage-page;
  --color-primary: var(--color-brand-blue-ink);
  --my-card-padding: var(--space-md);
  /* 마이와 카드 모두 공용 흰 바탕을 쓴다. */
  --my-card-surface: var(--color-surface);
  /*
   * 아이콘 크기와 색은 SEED 디자인(당근) 목록 규칙을 따른다.
   * 줄 끝 화살표는 20px, 회색(gray-500 #adb1ba), 줄 앞 아이콘은 24px, 선은 조금 두껍게 둔다.
   */
  --my-chevron-size: 1.25rem;
  --my-chevron-color: var(--color-muted);
  --my-icon-size: 1.5rem;
  --my-icon-stroke: 2.2;
  --my-card-radius: var(--radius-card);
  --my-text-size: 0.9375rem;
  --my-subtext-size: 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--color-surface);
`;

export const footer = css`
  label: MyPage-footer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-placeholder);
  font-size: 0.66rem;
`;
