import { css, cx } from '@emotion/css';

export const sectionHeadingRow = css`
  label: ChecklistEditor-sectionHeadingRow;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
`;

// 다른 요소의 선택자에서 `.ChecklistEditor-checklistEditor`로 가리킨다.
export const checklistEditor = cx(
  css`
    label: ChecklistEditor-checklistEditor;
    container: checklist-editor / inline-size;
    /* 셸이 이 화면에서는 선 색을 투명으로 두므로, 구분선이 보이게 토큰의 진한 선 색을 쓴다. */
    --color-border: var(--color-border-strong);

    & input,
    & textarea {
      width: 100%;
      min-height: 2.55rem;
      padding: 0.6rem 0.7rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
    }

    & textarea {
      min-height: 4.5rem;
      resize: vertical;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }

    & input[aria-invalid='true'],
    & textarea[aria-invalid='true'] {
      border-color: var(--color-error);
    }
  `,
  'ChecklistEditor-checklistEditor',
);

export const fixedSubmitEditor = css`
  label: ChecklistEditor-fixedSubmitEditor;
  padding-bottom: calc(9rem + env(safe-area-inset-bottom));
`;

// 다른 요소의 선택자에서 `.ChecklistEditor-editorSection`로 가리킨다.
export const editorSection = cx(
  css`
    label: ChecklistEditor-editorSection;
    margin-top: 0.55rem;
    padding: 0.6rem 0;
    border: 0;
    border-radius: 0;
    background: transparent;

    .ChecklistEditor-checklistEditor > &:first-child {
      margin-top: 0.15rem;
    }

    & + & {
      padding-bottom: calc(5rem + env(safe-area-inset-bottom));
    }

    & h2 {
      margin: 0;
      color: var(--color-ink);
      font-size: 0.8125rem;
      font-weight: 800;
    }

    .ChecklistEditor-checklistEditor & h2 {
      margin: 0;
      color: var(--color-ink);
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.4;
    }
  `,
  'ChecklistEditor-editorSection',
);

// 다른 요소의 선택자에서 `.ChecklistEditor-itemPicker`로 가리킨다.
export const itemPicker = cx(
  css`
    label: ChecklistEditor-itemPicker;
    margin-top: 0.55rem;
    padding: 0.6rem 0;
    border: 0;
    border-radius: 0;
    background: transparent;

    .ChecklistEditor-editorSection + &,
    & {
      padding-bottom: calc(5rem + env(safe-area-inset-bottom));
    }

    & + .ChecklistEditor-editorSection {
      border-top: 1px solid var(--color-border);
    }

    & h2 {
      margin: 0;
      color: var(--color-ink);
      font-size: 0.78rem;
    }
  `,
  'ChecklistEditor-itemPicker',
);

export const checkItemSearch = css`
  label: ChecklistEditor-checkItemSearch;
  margin-top: 0.5rem;
`;

export const selectionCount = css`
  label: ChecklistEditor-selectionCount;
  flex: 0 0 auto;
  color: var(--color-primary-dark);
  font-size: 0.65rem;
  font-weight: 800;
`;

export const selectedCheckItems = css`
  label: ChecklistEditor-selectedCheckItems;
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
  margin-top: 0.75rem;
`;

// 다른 요소의 선택자에서 `.ChecklistEditor-checkItemSearchResults`로 가리킨다.
export const checkItemSearchResults = cx(
  css`
    label: ChecklistEditor-checkItemSearchResults;
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;

    & li {
      position: relative;
      display: grid;
      align-items: center;
      min-height: 3.5rem;
      padding: 0.9rem 1rem;
      border: 0;
      border-radius: 1rem;
      background: var(--color-card-surface);
    }

    & strong,
    & small {
      display: block;
    }

    & strong {
      color: var(--color-ink);
      font-size: 0.9375rem;
      font-weight: 700;
      line-height: 1.4;
    }

    & small {
      margin-top: 0.1rem;
      color: var(--color-muted);
      font-size: 0.72rem;
      line-height: 1.45;
    }
  `,
  'ChecklistEditor-checkItemSearchResults',
);

export const emptyItems = css`
  label: ChecklistEditor-emptyItems;
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  margin: 0.8rem 0 0;
  padding: 0.8rem;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-ink-soft);
  text-align: center;
  min-height: auto;
  justify-content: flex-start;
  margin-top: 0.55rem;
  padding: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 0.7rem;
  line-height: 1.5;
  text-align: left;
`;

export const compactState = css`
  label: ChecklistEditor-compactState;
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  margin: 0.8rem 0 0;
  padding: 0.8rem;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-ink-soft);
  text-align: center;
`;

export const checkItemResults = css`
  label: ChecklistEditor-checkItemResults;
  margin-top: 1.5rem;

  & > h3 {
    margin: 0;
    color: var(--color-ink);
    font-size: 1.0625rem;
    font-weight: 800;
  }

  /* 카테고리 섹션은 구분선 대신 넉넉한 간격으로 나눈다. */
  & > section {
    padding: 0;
    margin-top: 1.75rem;
  }

  & > section + section {
    border-top: 0;
  }

  & > section > h3 {
    margin-bottom: 0.75rem;
    font-size: 1rem;
    font-weight: 800;
  }
`;

// 다른 요소의 선택자에서 `.ChecklistEditor-alreadyAddedItem`로 가리킨다.
export const alreadyAddedItem = cx(
  css`
    label: ChecklistEditor-alreadyAddedItem;

    .ChecklistEditor-checkItemSearchResults & {
      background: var(--color-surface-muted);
    }
  `,
  'ChecklistEditor-alreadyAddedItem',
);

export const existingDivider = css`
  label: ChecklistEditor-existingDivider;

  .ChecklistEditor-checkItemSearchResults & {
    display: flex;
    min-height: auto;
    align-items: center;
    gap: 0.6rem;
    margin: 0.25rem 0 0;
    padding: 0.25rem 0.15rem 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 750;
  }

  &::before,
  &::after {
    height: 1px;
    flex: 1;
    background: var(--color-border);
    content: '';
  }
`;

// 다른 요소의 선택자에서 `.ChecklistEditor-resultSelect`로 가리킨다.
export const resultSelect = cx(
  css`
    label: ChecklistEditor-resultSelect;

    .ChecklistEditor-alreadyAddedItem & {
      color: var(--color-muted);
    }

    & {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    &:disabled {
      cursor: default;
    }
  `,
  'ChecklistEditor-resultSelect',
);

export const resultControl = css`
  label: ChecklistEditor-resultControl;

  .ChecklistEditor-alreadyAddedItem &,
  .ChecklistEditor-alreadyAddedItem &[data-selected='true'] {
    border-color: var(--color-border-strong);
    background: var(--color-surface-disabled);
    color: var(--color-muted);
  }

  & {
    display: grid;
    width: 1.5rem;
    height: 1.5rem;
    border: 1.5px solid var(--color-border-strong);
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-on-primary);
    font-size: 0.8rem;
    font-weight: 900;
    place-items: center;
  }

  &[data-selected='true'] {
    border-color: var(--color-primary);
    background: var(--color-primary);
  }

  .ChecklistEditor-resultSelect:focus-visible & {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`;

export const resultCopy = css`
  label: ChecklistEditor-resultCopy;
  min-width: 0;

  .ChecklistEditor-alreadyAddedItem & strong {
    color: var(--color-muted);
    font-weight: 650;
  }
`;

export const compactButton = css`
  label: ChecklistEditor-compactButton;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.8rem;
  padding: 0.65rem 0;
  color: var(--color-error);
  font-size: 0.76rem;
  line-height: 1.45;
`;

export const pickerError = css`
  label: ChecklistEditor-pickerError;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.8rem;
  padding: 0.65rem 0;
  color: var(--color-error);
  font-size: 0.76rem;
  line-height: 1.45;
`;

export const pickerRetry = css`
  label: ChecklistEditor-pickerRetry;
  min-width: max-content;
  min-height: 2.5rem;
  padding: 0.4rem 0.5rem;
  white-space: nowrap;
`;

export const checklistItemPickerView = css`
  label: ChecklistEditor-checklistItemPickerView;

  & .ChecklistEditor-itemPicker {
    display: flex;
    flex-direction: column;
    min-height: calc(100dvh - var(--app-bar-height) - 8.5rem);
    margin-top: 0.55rem;
    padding: 0.65rem 0 calc(8rem + env(safe-area-inset-bottom));
    border: 0;
    border-radius: 0;
    background: transparent;
  }
`;

/* 취소는 좁게, 추가는 넓게. 두 버튼의 무게를 다르게 둔다. */
export const pickerActions = css`
  label: ChecklistEditor-pickerActions;
  grid-auto-flow: row;
  grid-template-columns: minmax(5rem, 0.42fr) minmax(0, 1fr);
  gap: 0.5rem 0.75rem;

  /* 위쪽은 흰색으로 부드럽게 사라지는 그라데이션, 구분선과 그림자는 두지 않는다. */
  && {
    padding-top: 1.75rem;
    border-top: 0;
    background: linear-gradient(to bottom, rgb(255 255 255 / 0%), var(--color-canvas) 1.5rem);
    box-shadow: none;
  }

  & > p {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.8125rem;
  }

  & button {
    min-height: 3rem;
    border-radius: 0.875rem;
    font-size: 0.9375rem;
    font-weight: 800;
  }
`;

export const editorSaveStatus = css`
  label: ChecklistEditor-editorSaveStatus;
  margin: 0;
  &:empty {
    display: none;
  }
  color: var(--color-muted);
  font-size: 0.78rem;
`;

export const fixedActions = css`
  label: ChecklistEditor-fixedActions;
  width: min(100%, var(--checklist-action-width, 100vw));
`;

export const editorActions = css`
  label: ChecklistEditor-editorActions;
  grid-auto-flow: row;
  grid-template-columns: minmax(0, 1fr);
`;

export const addActionRow = css`
  label: ChecklistEditor-addActionRow;
  display: flex;
  justify-content: flex-end;
`;

export const categoryFilters = css`
  label: ChecklistEditor-categoryFilters;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: var(--space-lg);
  padding: 0;
  background: transparent;
  & button {
    min-height: 2.5rem;
    padding: 0.4rem 0.9rem;
    border: 0;
    border-radius: var(--radius-full, 999px);
    background: var(--color-card-surface);
    font-weight: 500;
  }
  & button[aria-checked='true'] {
    background: var(--color-surface-muted);
    color: var(--color-ink);
    font-weight: 800;
    box-shadow: none;
  }
`;
