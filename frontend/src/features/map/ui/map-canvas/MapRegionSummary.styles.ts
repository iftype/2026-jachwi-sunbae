import { css, cx } from '@emotion/css';

// 다른 요소의 선택자에서 `.MapRegionSummary-summary`로 가리킨다.
export const summary = cx(
  css`
    label: MapRegionSummary-summary;
    scale: var(--map-region-scale, 1);
    transform-origin: center;
    width: 108px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #222;
    cursor: pointer;
    text-align: center;
    font-family: inherit;

    & > strong {
      display: block;
      margin-bottom: 3px;
      font-size: 11px;
      line-height: 1.2;
      text-shadow:
        0 1px 3px white,
        0 -1px 3px white;
    }
  `,
  'MapRegionSummary-summary',
);

export const cells = css`
  label: MapRegionSummary-cells;
  transition: background-color 140ms ease;
  display: grid;
  background: white;
  border: 1px solid #b8bbc0;
  border-radius: 4px;
  box-shadow: 0 2px 7px rgb(0 0 0 / 14%);
  overflow: hidden;

  .MapRegionSummary-summary:is(:hover, :focus-visible, [data-hovered='true']) & {
    background: #fff3d2;
  }

  .MapRegionSummary-summary:not([data-colored='true'])[aria-pressed='true']:is(
      :hover,
      :focus-visible,
      [data-hovered='true']
    )
    & {
    background: #ffe79a;
  }

  & > span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 5px 6px;
    line-height: 1.2;
  }

  & > span + span {
    border-top: 1px solid #e0e2e5;
  }

  & small {
    font-size: 8px;
    color: #666;
    white-space: nowrap;
  }

  & b {
    font-size: 11px;
    white-space: nowrap;
  }

  .MapRegionSummary-summary[aria-pressed='true'] & {
    background: #fff3bc;
    box-shadow:
      0 0 0 1px #969ba2,
      0 2px 7px rgb(0 0 0 / 14%);
  }

  .MapRegionSummary-summary[data-colored='true'] & {
    border-color: var(--region-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--region-accent) 65%, transparent);
  }

  .MapRegionSummary-summary[data-colored='true'][aria-pressed='true'] & {
    background: color-mix(in srgb, var(--region-accent) 18%, white);
  }
`;

/** 동 이름 아래에 통근 시간과 평균 월세를 붙인 작은 라벨. 지도 색칠 위에서도 읽히게 흰 바탕과 옅은 테두리를 둔다. */
export const rentLabel = css`
  label: MapRegionSummary-rentLabel;
  scale: var(--map-region-scale, 1);
  transform-origin: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: max-content;
  max-width: 96px;
  padding: 2px 6px 3px;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 6px;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 1px 4px rgb(0 0 0 / 16%);
  color: #222;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.25;
  text-align: center;

  & > strong {
    font-size: 11px;
    white-space: nowrap;
  }

  & > span {
    display: flex;
    align-items: baseline;
    gap: 3px;
    white-space: nowrap;
  }

  & b {
    font-size: 11px;
    color: #3f6fc4;
  }

  & i {
    font-size: 11px;
    font-style: normal;
    font-weight: 700;
    color: #444a55;
  }

  & b[data-empty='true'] {
    color: #868b94;
    font-weight: 500;
  }

  &[data-sparse='true'] b {
    color: #8a909a;
    font-weight: 500;
  }

  /* 멀리 볼 때는 동 이름만 남긴다. 통근 시간과 월세는 읽기 도구 이름(aria-label)에 그대로 있다. */
  &[data-compact='true'] > span {
    display: none;
  }

  &[data-filtered-out='true'] {
    opacity: 0.5;
  }

  /* 찜한 동네 이름표. 동 이름만 두므로 크게 쓰고 찜 색 테두리로 찜한 영역임을 알린다. */
  &[data-bookmark='true'] {
    flex-direction: row;
    align-items: baseline;
    gap: 5px;
    max-width: 220px;
    padding: 5px 11px;
    border: 1.5px solid #2554b8;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 2px 6px rgb(37 84 184 / 28%);
    color: #2554b8;
  }

  &[data-bookmark='true'] > strong {
    font-size: 14px;
    font-weight: 800;
  }

  &[data-bookmark='true'] > small {
    color: #3f6fc4;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  /* 찜한 동네의 월세 라벨. 연한 파랑 바탕과 파랑 테두리로 구분하고 이름 앞에 채운 별을 둔다. */
  &[data-saved='true'] {
    border: 1.5px solid #2554b8;
    background: #e3ecfb;
  }

  &[aria-pressed='true'] {
    border-color: #3f6fc4;
    box-shadow: 0 0 0 1px #3f6fc4;
  }
`;

export const savedStar = css`
  label: MapRegionSummary-savedStar;
  margin-right: 2px;
  color: #2554b8;
  font-size: 10px;
  font-style: normal;
`;

/** 휴대폰 지도의 동 이름표. `동 이름 통근 시간` 한 줄짜리 작은 알약으로 두고, 월세는 동네 시트에서 본다. */
export const chip = css`
  label: MapRegionSummary-chip;
  scale: var(--map-region-scale, 1);
  transform-origin: center;
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  width: max-content;
  padding: 2px 7px;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 999px;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 1px 3px rgb(0 0 0 / 16%);
  color: #222;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;

  & > strong {
    font-weight: 700;
  }

  & > b {
    color: #3f6fc4;
    font-weight: 700;
  }

  &[data-filtered-out='true'] {
    opacity: 0.55;
  }

  /* 찜한 동네. 이름 앞 별과 파랑 테두리로 구분한다. */
  &[data-saved='true'],
  &[data-bookmark='true'] {
    border: 1.5px solid #2554b8;
    color: #2554b8;
  }

  /* 고른 동네는 진한 바탕으로 강조하고 다른 이름표보다 앞에 둔다. */
  &[aria-pressed='true'] {
    border-color: #25282d;
    background: #25282d;
    color: #fff;
    opacity: 1;
  }

  &[aria-pressed='true'] > b,
  &[aria-pressed='true'] > strong > span {
    color: #ffd76a;
  }
`;
