import { css } from '@emotion/css';

export const items = css`
  label: RecordList-items;
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  /* 목록 칸이 화면 폭에 따라 좁아져도 카드가 칸을 넘지 않게, 긴 주소는 줄여 보이고 오른쪽 메뉴는 칸 안에 남긴다. */
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
`;

/* 지도에서 고른 매물을 목록에서도 알아보게, 테두리 없이 카드 뒤에 옅은 파란 바탕만 깐다. */
export const item = css`
  label: RecordList-item;
  border-radius: 1rem;

  &[data-selected='true'] {
    background: #eef3ff;
    box-shadow: 0 0 0 0.5rem #eef3ff;

    /* 카드 안쪽의 흰 바탕도 같은 색으로 칠해, 흰 네모가 따로 떠 보이지 않게 한다. */
    & > * {
      background: transparent;
    }
  }
`;

export const actions = css`
  label: RecordList-actions;
  position: relative;
  z-index: 2;
`;

export const menuToggle = css`
  label: RecordList-menuToggle;
  display: grid;
  width: 2rem;
  height: 2rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #7c828b;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }

  &:focus-visible {
    outline: 2px solid #25282d;
    outline-offset: 3px;
  }

  @media (max-width: 360px) {
    width: 1.6rem;
    height: 1.6rem;
  }
`;

export const menu = css`
  label: RecordList-menu;

  & button:focus-visible {
    outline: 2px solid #25282d;
    outline-offset: 3px;
  }

  & {
    position: absolute;
    top: 2.1rem;
    right: 0;
    z-index: 5;
    min-width: 5rem;
    padding: 0.15rem;
    border: 1px solid #eceef1;
    border-radius: 0.6rem;
    background: white;
    box-shadow: 0 1px 6px rgb(0 0 0 / 8%);
  }

  & button {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.55rem;
    border: 0;
    border-radius: 0.45rem;
    background: transparent;
    color: #c44e4e;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.2;
    text-align: left;
    cursor: pointer;
  }

  /* 휴지통 아이콘은 글자 높이에 맞춰 작고 가는 선으로 그린다. */
  & button svg {
    width: 0.85rem;
    height: 0.85rem;
    stroke-width: 1.7;
  }

  & button:hover {
    background: #fff3f3;
  }
`;
