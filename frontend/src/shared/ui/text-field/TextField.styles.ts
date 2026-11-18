import { css, cx } from '@emotion/css';

// 다른 요소의 선택자에서 `.TextField-field`로 가리킨다.
export const field = cx(
  css`
    label: TextField-field;
    display: grid;
    gap: 0.3rem;

    & > label {
      color: var(--color-ink);
      font-size: 0.72rem;
      font-weight: 800;
    }

    /* 비어 있을 때는 placeholder를 입력칸 안에 보여주고, 포커스/입력 시 라벨을 현재 라벨 위치로 올린다. */
    &[data-floating-label='true'] {
      gap: 0.3rem;
    }

    /* 큰 입력칸: 매물 등록처럼 한 칸씩 묻는 폼에서 쓴다. */
    &[data-size='large'] {
      gap: 0.45rem;
    }

    /*
   * 채움형(기본): 테두리 없는 회색 칸에 12px 모서리. 포커스하면 노란 테두리, 커서는 파란색,
   * 오류면 빨간 테두리와 칸 아래 오류 문구를 보여 준다. 라벨은 칸 위에 둔다.
   */
    &[data-variant='filled'] {
      gap: 0.5rem;
    }

    &[data-variant='filled'] > label {
      color: var(--color-ink);
      font-size: 0.9375rem;
      font-weight: 500;
      line-height: 1.375rem;
    }
  `,
  'TextField-field',
);

// 다른 요소의 선택자에서 `.TextField-requiredMarker`로 가리킨다.
export const requiredMarker = cx(
  css`
    label: TextField-requiredMarker;
    margin-right: 0.2rem;
    /* 필수 표시 자체의 의미 색상은 라벨의 포커스 색과 분리한다. */
    color: var(--color-danger, #c96b6b);
    font-size: 0.8rem;
    font-weight: 800;
  `,
  'TextField-requiredMarker',
);

// 다른 요소의 선택자에서 `.TextField-control`로 가리킨다.
export const control = cx(
  css`
    label: TextField-control;
    position: relative;

    .TextField-field[data-floating-label='true'] & {
      padding-top: 0.72rem;
    }

    .TextField-field[data-floating-label='true'] & input {
      caret-color: var(--color-ink);
      line-height: 1.6;
    }

    .TextField-field[data-floating-label='true'] & input:focus::placeholder {
      color: transparent;
    }

    & input,
    & textarea {
      width: 100%;
      min-height: 2.55rem;
      padding: 0.62rem 0.75rem;
      resize: vertical;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      line-height: 1.45;
    }

    & input,
    & textarea {
      cursor: text;
    }

    .TextField-field[data-variant='inline'] & textarea {
      display: block;
      min-height: 1.75rem;
      /* 글자가 칸 가장자리에 붙지 않게 아주 작은 안쪽 여백을 두고, 모서리를 둥글게 한다. 바탕은 입력할 때만 깐다. */
      padding: 0.3rem 0.6rem;
      /* 안쪽 여백만큼 칸을 양옆으로 밀어, 글자(메모 추가)의 왼쪽 선이 위 질문 글자와 맞게 한다. */
      width: calc(100% + 1.2rem);
      margin-inline: -0.6rem;
      border: 0;
      border-radius: 0.6rem;
      background: transparent;
      color: var(--color-muted);
      font-size: 0.8125rem;
      line-height: 1.5;
      resize: none;
      field-sizing: content;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }

    .TextField-field[data-variant='inline'] & textarea::placeholder {
      color: var(--color-muted);
    }

    /* 입력할 때 테두리(포커스 링)를 두르지 않는다. 입력 중임은 옅은 회색 바탕으로만 알린다. */
    .TextField-field[data-variant='inline'] & textarea:focus-visible {
      outline: 0;
      box-shadow: none;
      background: var(--color-card-surface);
    }

    @media (pointer: coarse) {
      .TextField-field[data-variant='inline'] & textarea {
        min-height: 2.75rem;
        font-size: 1rem;
      }
    }

    .TextField-field[data-size='large'] & input {
      min-height: 3.25rem;
      font-size: 1.15rem;
    }

    /* 밑줄형: 네모 테두리를 걷고 아래 선만 남긴다. */
    .TextField-field[data-variant='underline'] & input,
    .TextField-field[data-variant='underline'] & textarea {
      padding-right: 0;
      padding-left: 0;
      border: 0;
      border-bottom: 1.5px solid var(--color-border-strong);
      border-radius: 0;
      background: transparent;
    }

    .TextField-field[data-floating-label='true'][data-variant='underline'] & input {
      min-height: 2.4rem;
      padding-bottom: 0.38rem;
    }

    .TextField-field[data-floating-label='true'][data-size='large'][data-variant='underline'] & input {
      min-height: 2.8rem;
      padding-bottom: 0;
    }

    .TextField-field[data-variant='underline'] & input:focus-visible,
    .TextField-field[data-variant='underline'] & textarea:focus-visible {
      border-bottom-color: var(--color-brand-yellow);
      border-bottom-width: 2px;
      outline: none;
      box-shadow: none;
    }

    .TextField-field[data-variant='underline'] & input[aria-invalid='true'] {
      border-bottom-color: var(--color-danger, #c96b6b);
    }

    .TextField-field:has(& input[aria-invalid='true']) > label,
    & input[aria-invalid='true'] {
      color: var(--color-danger, #c96b6b);
    }

    & input::placeholder,
    & textarea::placeholder {
      color: var(--color-placeholder);
      /* 입력 글자와 같은 크기로 둔다. 따로 줄이면 placeholder만 유독 작아 보인다. */
      font-size: inherit;
    }

    & input:focus-visible,
    & textarea:focus-visible {
      border-color: color-mix(in srgb, var(--color-focus) 58%, var(--color-border-strong));
      outline: 0;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-focus) 10%, transparent);
    }

    & input[aria-invalid='true'],
    & textarea[aria-invalid='true'] {
      border-color: var(--color-error);
      background: var(--color-error-surface);
    }

    .TextField-field[data-variant='filled'] & input,
    .TextField-field[data-variant='filled'] & textarea {
      min-height: 3rem;
      padding: 0.75rem 1rem;
      border: 0;
      border-radius: 0.75rem;
      background: var(--color-card-surface);
      caret-color: var(--color-ink);
      font-size: 0.9375rem;
      line-height: 1.375rem;
      transition: box-shadow 0.16s ease;
    }

    .TextField-field[data-variant='filled'] & input:focus,
    .TextField-field[data-variant='filled'] & textarea:focus {
      outline: 0;
      box-shadow: inset 0 0 0 2px var(--color-brand-yellow);
    }

    .TextField-field[data-variant='filled'] & input[aria-invalid='true'],
    .TextField-field[data-variant='filled'] & textarea[aria-invalid='true'] {
      background: var(--color-card-surface);
      box-shadow: inset 0 0 0 1.5px var(--color-danger, #c96b6b);
    }

    .TextField-field[data-variant='filled'][data-size='large'] & input {
      min-height: 3.25rem;
      padding: 0.875rem 1rem;
      font-size: 1rem;
    }
  `,
  'TextField-control',
);

export const floatingLabel = css`
  label: TextField-floatingLabel;
  position: absolute;
  top: 1.7rem;
  left: 0;
  z-index: 1;
  color: var(--color-placeholder);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.45;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition:
    top 0.16s ease,
    color 0.16s ease,
    opacity 0.16s ease,
    transform 0.16s ease;
  will-change: top, opacity, transform;

  .TextField-field[data-floating-label='true']:focus-within &,
  .TextField-field[data-floating-label='true']:has(input:not(:placeholder-shown)) &,
  .TextField-field[data-floating-label='true']:has(input[aria-invalid='true']) & {
    top: 0.92rem;
    color: var(--color-muted);
    font-size: 0.72rem;
    font-weight: 500;
    opacity: 1;
    transform: translateY(-50%);
  }

  /* :has(input:not(:placeholder-shown))의 우선순위가 더 높으므로 포커스된 input을 직접 기준으로 삼는다. */
  .TextField-field[data-floating-label='true']:focus-within &,
  .TextField-field[data-floating-label='true']:has(input:focus) & {
    color: var(--color-muted);
  }

  /* 포커스·입력으로 라벨 색이 바뀌어도 필수 표시는 계속 의미 색을 유지한다. */
  .TextField-field[data-floating-label='true'] & .TextField-requiredMarker {
    color: var(--color-danger, #c96b6b);
  }

  .TextField-field[data-size='large'][data-floating-label='true'] & {
    top: 2rem;
  }

  .TextField-field[data-size='large'][data-floating-label='true']:focus-within &,
  .TextField-field[data-size='large'][data-floating-label='true']:has(input:not(:placeholder-shown)) &,
  .TextField-field[data-size='large'][data-floating-label='true']:has(input[aria-invalid='true']) & {
    top: 0.92rem;
  }

  .TextField-field[data-floating-label='true'][data-variant='box'] & {
    left: 0.75rem;
  }

  .TextField-field[data-floating-label='true'][data-variant='box']:focus-within &,
  .TextField-field[data-floating-label='true'][data-variant='box']:has(input:not(:placeholder-shown)) &,
  .TextField-field[data-floating-label='true'][data-variant='box']:has(input[aria-invalid='true']) & {
    padding: 0 0.2rem;
    background: var(--color-surface);
  }

  .TextField-field[data-floating-label='true']:has(input[aria-invalid='true']) & {
    color: var(--color-danger, #c96b6b);
  }
`;

export const suffix = css`
  label: TextField-suffix;

  /* 단위 표시가 붙는 칸만 오른쪽을 비워 글자가 겹치지 않게 한다. */
  .TextField-field[data-variant='underline'] .TextField-control:has(&) input {
    padding-right: 2.6rem;
  }

  .TextField-control:has(&) input {
    padding-right: 2.8rem;
  }

  & {
    position: absolute;
    top: 50%;
    right: 0.9rem;
    color: var(--color-muted);
    font-size: 0.82rem;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .TextField-field[data-size='large'][data-variant='underline'] & {
    top: calc(50% + 0.4rem);
  }

  .TextField-field[data-variant='filled'] .TextField-control:has(&) input {
    padding-right: 3rem;
  }

  .TextField-field[data-variant='filled'] & {
    right: 1rem;
    font-size: 0.9375rem;
  }
`;

export const help = css`
  label: TextField-help;
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--color-muted);

  .TextField-field[data-variant='filled'] & {
    padding: 0 0.25rem;
    font-size: 0.875rem;
    line-height: 1.1875rem;
  }
`;

export const error = css`
  label: TextField-error;
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--color-danger, #ff4b4b);
  font-weight: 700;

  .TextField-field[data-variant='filled'] & {
    padding: 0 0.25rem;
    font-size: 0.875rem;
    line-height: 1.1875rem;
  }

  /* 채움형 오류 문구는 앞에 빨간 원형 느낌표를 붙여 칸 바로 아래에 보여 준다. */
  .TextField-field[data-variant='filled'] & {
    display: flex;
    gap: 0.375rem;
    align-items: flex-start;
    margin-top: 0.25rem;
    font-weight: 400;
  }

  .TextField-field[data-variant='filled'] &::before {
    display: grid;
    width: 1rem;
    height: 1rem;
    flex: none;
    margin-top: 0.09rem;
    border-radius: 50%;
    background: var(--color-danger, #ff4b4b);
    color: white;
    content: '!';
    font-size: 0.7rem;
    font-weight: 800;
    line-height: 1;
    place-items: center;
  }
`;
