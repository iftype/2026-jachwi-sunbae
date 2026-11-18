import { css } from '@emotion/css';

/* 휴대폰·태블릿 본 방 기록: 화면 틀, 리스트 칸, 헤더(뒤로가기·지도/리스트 전환), 지도 위에 뜬 헤더. 매물은 지도를 눌러 기록한다. */
export const page = css`
  label: RecordsMobilePage-page;
  height: 100dvh;
  background: #f0f2f5;
  color: #25282d;
`;

export const frame = css`
  label: RecordsMobilePage-frame;
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 48rem);
  height: 100%;
  margin: 0 auto;
  background: white;
  overflow: hidden;

  & button:focus-visible {
    outline: 2px solid #25282d;
    outline-offset: 3px;
  }
`;

export const body = css`
  label: RecordsMobilePage-body;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

export const list = css`
  label: RecordsMobilePage-list;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 1rem calc(6rem + var(--map-sheet-bottom, 0px));
  background: white;

  /* 태블릿 너비부터는 배치는 그대로 두고 글자와 여백만 키운다. */
  @media (min-width: 768px) {
    padding: 1rem 1.5rem 2rem;
  }
`;

/*
 * 지도 보기에서는 헤더와 동네 뱃지를 흰 배경 없이 지도 위에 띄운다.
 * 빈 자리는 지도 조작을 막지 않는다. 뒤로가기·보기 전환은 흰 바탕과 테두리·그림자로 지도 위에서도 잘 보인다.
 */
export const mapChrome = css`
  label: RecordsMobilePage-mapChrome;
  position: absolute;
  z-index: 15;
  top: 0;
  right: 0;
  left: 0;
  pointer-events: none;

  & a,
  & button,
  & nav {
    pointer-events: auto;
  }
`;

export const listTools = css`
  label: RecordsMobilePage-listTools;
  display: flex;
  justify-content: flex-end;
  padding: 0.25rem var(--space-md);
  & a {
    color: var(--color-brand-blue-ink);
    font-size: 0.8rem;
    text-decoration: none;
  }
`;
