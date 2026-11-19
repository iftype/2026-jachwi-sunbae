import { css } from '@emotion/css';

/**
 * `BottomSheet`의 `floating` 안에 둔 요소에 붙이면, 시트를 크게(expanded) 열었을 때 숨긴다.
 * 시트가 화면 위쪽까지 올라와 머리 줄이나 다른 컨트롤과 부딪히므로, 겹쳐 보이는 대신 시트 뒤로 감춘다.
 */
export const hideWhenSheetExpanded = css`
  label: BottomSheet-hideWhenExpanded;
  transition:
    opacity 120ms ease,
    visibility 120ms;

  .BottomSheet-floating[data-mode='expanded'] & {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
`;
