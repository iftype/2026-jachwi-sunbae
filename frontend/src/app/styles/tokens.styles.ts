import { injectGlobal } from '@emotion/css';

injectGlobal`
:root {
  --color-brand-50: #f7f7f7;
  --color-brand-100: #f0f0f0;
  --color-brand-200: #e5e5e5;
  --color-brand-300: #d4d4d4;
  --color-brand-400: #999;
  --color-brand-500: #555;
  --color-brand-600: #333;
  --color-brand-700: #222;
  --color-brand-800: #1f1f1f;
  --color-brand-900: #111;
  --color-brand-yellow: #f5b91e;
  /* 오리 부리보다 채도를 조금 낮춘 파랑. 안내 카드처럼 노랑과 짝을 이루는 보조 브랜드색이다. */
  --color-brand-blue: #6b9ae6;
  /* 옅은 파랑 바탕 위에 올리는 진한 파랑 글자 */
  --color-brand-blue-ink: #3f6fc4;
  --color-danger: #c96b6b;
  --color-provider-kakao: #fee500;
  --color-on-provider-kakao: rgb(0 0 0 / 85%);
  --color-provider-apple: #000;
  --color-on-provider-apple: #fff;

  /* Change this single accent to retheme selected tabs, progress indicators and soft actions together. */
  --color-theme-accent: var(--color-brand-500);
  --color-theme-accent-strong: var(--color-brand-700);

  /* Neutral surfaces and readable foregrounds. */
  --color-canvas: #fff;
  --color-cream: #fff;
  --color-surface: #fff;
  --color-surface-muted: #f7f7f7;
  --color-surface-neutral: #f1f1f1;
  --color-surface-disabled: #ebebeb;
  --color-surface-brand: #f2f2f2;
  --color-surface-brand-strong: var(--color-theme-accent);
  --color-navigation-surface: #fff;
  --color-ink: #212124;
  --color-ink-soft: #5f6368;
  --color-muted: #868b94;
  --color-placeholder: #a8abb0;
  --color-border: #eaebed;
  --color-border-strong: #d7d9dc;
  --color-search-surface: #f2f3f4;
  --color-search-foreground: #212124;
  --color-search-placeholder: #8f949b;
  --color-on-brand-soft: #212124;

  /* Form submit actions stay distinct from the lighter navigation accent. */
  --color-action: var(--color-brand-600);
  --color-action-hover: var(--color-brand-700);
  --color-on-action: #fff;

  /* Interactive colors use darker shades so text keeps sufficient contrast. */
  --color-primary: var(--color-brand-600);
  --color-primary-strong: var(--color-brand-700);
  --color-primary-dark: var(--color-brand-800);
  --color-focus: var(--color-brand-700);
  --color-on-primary: #fff;

  /* Semantic colors stay separate from the brand palette. */
  --color-accent: #e6b84d;
  --color-warning: #666;
  --color-warning-ink: #444;
  --color-warning-surface: #f4f4f4;
  --color-error: #222;
  --color-error-surface: #f1f1f1;
  --color-success: #333;
  --color-success-surface: #f1f1f1;
  /* 체크 상태: 괜찮음은 브랜드 파랑, 주의는 빨강, 미확인은 회색. */
  --color-check-good: var(--color-brand-blue);
  --color-check-good-ink: var(--color-brand-blue-ink);
  --color-check-caution: #ef7b7b;
  --color-check-caution-ink: #d14d4d;
  --color-check-unconfirmed: #c6c6c6;
  --color-check-unconfirmed-ink: #666;
  /* 거리 메모: 좋아요는 옅은 파랑, 싫어요는 옅은 빨강 바탕에 같은 계열의 진한 글자를 올린다. 지도 위에서 튀지 않게 채도를 낮췄다. */
  --color-memo-like: #cfe2fa;
  --color-memo-like-ink: #24497f;
  --color-memo-dislike: #f7cfcf;
  --color-memo-dislike-ink: #8a2c2c;

  /* Card-style home: 기능 카드·바로가기 타일·레일 카드가 함께 쓰는 표면과 강조색. */
  --color-card-surface: #f1f2f4;
  --color-card-surface-hover: #e8ebef;
  --color-card-brand-surface: var(--color-brand-yellow);
  --color-card-informative-surface: var(--color-brand-blue);
  --color-on-card-accent: #fff;
  --color-page-subtle: #f0f2f5;
  --color-price: #5279d2;

  --color-overlay: rgb(17 20 29 / 56%);
  --color-overlay-strong: rgb(17 20 29 / 78%);
  --color-surface-translucent: rgb(255 255 255 / 96%);
  --shadow-app-shell: 0 0 2.5rem rgb(30 35 52 / 10%);
  /* 지도 위에 띄운 검색창, 버튼처럼 바탕 위로 살짝 뜬 요소. 지도 현재 위치 버튼과 같은 그림자다. */
  --shadow-floating: 0 0.35rem 1rem rgb(42 48 35 / 18%);
  /* 가운데 창(대화상자)처럼 화면 위에 크게 뜬 요소. */
  --shadow-dialog: 0 0.75rem 2.5rem rgb(0 0 0 / 18%);
  --radius-sm: 0.65rem;
  --radius-md: 0.85rem;
  --radius-lg: 1.05rem;
  --radius-card: 1.15rem;
  --radius-tile: 1rem;
  --space-xs: 0.4rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --page-inline-padding: 1rem;
  /* 홈 카드(사용방법, 기능 카드, 저렴한 한 끼)가 함께 쓰는 글자 크기, 위치, 간격. 카드마다 다르게 두지 않는다. */
  --home-card-title-size: 1.35rem;
  --home-card-title-line-height: 1.25;
  --home-card-description-size: 0.88rem;
  --home-card-text-inset: 1rem;
  --home-card-text-gap: 0.3rem;
  --app-max-width: 24.375rem;
  --app-bar-height: 2.9rem;
  --bottom-navigation-height: 2.47rem;
}

/* 태블릿 너비부터 카드가 넓어지는 만큼 홈 카드 글자와 여백을 키운다. */
@media (min-width: 768px) {
  :root {
    --home-card-title-size: 1.5rem;
    --home-card-description-size: 0.95rem;
    --home-card-text-inset: 1.6rem;
  }
}
`;
