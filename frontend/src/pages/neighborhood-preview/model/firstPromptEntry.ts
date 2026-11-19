/** 내 기록의 동네 찾기 첫 안내(데스크탑 배너, 휴대폰 머리 칩)로 동네 찾기에 들어올 때 이동 state에 싣는 표시. */
export const FIRST_PROMPT_ENTRY_STATE = { fromFirstPrompt: true } as const;

/** 이동 state가 첫 안내로 들어온 표시인지. */
export const isFirstPromptEntry = (state: unknown): boolean =>
  state !== null && typeof state === 'object' && 'fromFirstPrompt' in state && state.fromFirstPrompt === true;
