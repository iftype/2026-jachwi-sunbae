import { css, cx, keyframes } from '@emotion/css';

const searchCardRiseKeyframes = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.75rem);
  }
`;

// 다른 요소의 선택자에서 `.NeighborhoodPreviewPage-page`로 가리킨다.
export const page = cx(
  css`
    label: NeighborhoodPreviewPage-page;
    position: relative;
    height: 100%;
    overflow-y: auto;
    background: white;
    color: var(--color-ink);
  `,
  'NeighborhoodPreviewPage-page',
);

export const recordAction = css`
  label: NeighborhoodPreviewPage-recordAction;
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom) + 0.75rem);
  left: 1rem;
  right: 1rem;
  z-index: 2;
`;

export const topAreaRail = css`
  label: NeighborhoodPreviewPage-topAreaRail;

  .NeighborhoodPreviewPage-page[data-public-explore='true'] & {
    bottom: calc(env(safe-area-inset-bottom) + 4.5rem);
  }

  & {
    position: absolute;
    left: 0.75rem;
    right: 0;
    bottom: calc(var(--map-sheet-bottom, env(safe-area-inset-bottom)) + 0.4rem);
    padding: 0.7rem 0 0.3rem;
    background: transparent;
    z-index: 1;
  }
`;

export const locationControls = css`
  label: NeighborhoodPreviewPage-locationControls;
  position: absolute;
  top: 5rem;
  right: 0.85rem;
  z-index: 30;
  .NeighborhoodPreviewPage-page &[data-docked='true'] {
    position: relative;
    top: auto;
    right: auto;
    bottom: auto;
  }
`;

// 다른 요소의 선택자에서 `.NeighborhoodPreviewPage-mapSearch`로 가리킨다.
export const mapSearch = cx(
  css`
    label: NeighborhoodPreviewPage-mapSearch;
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;

    & > :last-child {
      flex: 1;
    }
  `,
  'NeighborhoodPreviewPage-mapSearch',
);

// 다른 요소의 선택자에서 `.NeighborhoodPreviewPage-mapBack`로 가리킨다.
export const mapBack = cx(
  css`
    label: NeighborhoodPreviewPage-mapBack;
    display: grid;
    flex: none;
    box-sizing: border-box;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    place-items: center;
    border: 1px solid #e3e5e9;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 6px rgb(0 0 0 / 8%);
    color: #383c43;
    cursor: pointer;
  `,
  'NeighborhoodPreviewPage-mapBack',
);

/* 데스크탑 헤더 안의 검색창은 본 방 기록과 같은 흰 칸에 그림자를 쓴다(`activeSearchField`). */
export const headerMapSearch = css`
  label: NeighborhoodPreviewPage-headerMapSearch;
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;

  & > :last-child {
    flex: 1;
  }

  & .NeighborhoodPreviewPage-mapBack {
    width: 2.5rem;
    height: 2.5rem;
    box-shadow: none;
  }
`;

export const mapOption = css`
  label: NeighborhoodPreviewPage-mapOption;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.8rem;
  padding: 0.85rem;
  background: white;
  color: var(--color-ink);
  border: 1px solid var(--color-border);
  border-radius: 0.6rem;
  cursor: pointer;
  font-size: 0.85rem;
`;

export const confirmPoint = css`
  label: NeighborhoodPreviewPage-confirmPoint;
  margin: 0;
  min-height: 2.75rem;
  padding: 0.55rem 0.7rem;
  font-size: 0.75rem;
  white-space: nowrap;
  flex: 1;
`;

export const analysis = css`
  label: NeighborhoodPreviewPage-analysis;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem calc(2rem + var(--map-sheet-bottom, 0px));
  text-align: center;

  & h1 {
    font-size: 1.3rem;
    margin: 1.5rem 0 0.5rem;
    letter-spacing: -0.04em;
  }

  & p {
    color: var(--color-ink-soft);
    font-size: 0.8rem;
  }

  & ol {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
    display: grid;
    gap: 0.8rem;
    text-align: left;
    font-size: 0.85rem;
    color: var(--color-muted);
  }

  & li[data-active='true'] {
    color: var(--color-ink);
    font-weight: 750;
  }

  & li[data-done='true'] {
    color: var(--color-ink-soft);
  }

  & small {
    margin-top: 0.5rem;
    color: var(--color-muted);
    font-size: 0.65rem;
  }

  & button {
    margin-top: 1.5rem;
  }
`;

export const start = css`
  label: NeighborhoodPreviewPage-start;
  width: min(100%, 29rem);
  margin: auto;
  padding: clamp(3rem, 12dvh, 8rem) 1.5rem calc(2rem + var(--map-sheet-bottom, 0px));

  & h1 {
    font-size: clamp(2rem, 5vw, 2.5rem);
    line-height: 1.35;
    letter-spacing: -0.05em;
    margin: 0 0 1rem;
  }

  & > p {
    font-size: 0.9rem;
    color: var(--color-ink-soft);
    margin-bottom: 2rem;
  }
`;

export const brand = css`
  label: NeighborhoodPreviewPage-brand;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 800;
  margin-bottom: 3rem;

  & img {
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
  }
`;

export const options = css`
  label: NeighborhoodPreviewPage-options;
  margin-top: 1.5rem;

  & > small {
    font-size: 0.75rem;
    color: var(--color-muted);
  }
`;

export const startNote = css`
  label: NeighborhoodPreviewPage-startNote;
  font-size: 0.75rem;
  color: var(--color-muted);
  display: block;
  margin-top: 3rem;
`;

export const destination = css`
  label: NeighborhoodPreviewPage-destination;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 1rem 0;
  background: none;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  color: inherit;
  cursor: pointer;

  & span {
    flex: 1;
    font-weight: 650;
  }

  & small {
    display: block;
    margin-top: 0.4rem;
    font-size: 0.7rem;
    color: var(--color-muted);
    font-weight: 400;
  }
`;

export const mapPage = css`
  label: NeighborhoodPreviewPage-mapPage;
  height: 100%;
  position: relative;
  isolation: isolate;
`;

// 다른 요소의 선택자에서 `.NeighborhoodPreviewPage-filters`로 가리킨다.
export const filters = cx(
  css`
    label: NeighborhoodPreviewPage-filters;

    & label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.8rem;
      flex: 0 1 auto;
      flex-direction: column;
      align-items: stretch;
      gap: 0.35rem;
    }

    & select {
      background: white;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      padding: 0.4rem 0.65rem;
      font-size: 0.75rem;
      max-width: 100%;
      color: inherit;
    }

    & {
      display: flex;
      gap: 0.4rem;
      padding: 0;
      margin-top: 0.5rem;
      background: transparent;
      flex-wrap: wrap;
    }
  `,
  'NeighborhoodPreviewPage-filters',
);

export const minuteBadge = css`
  label: NeighborhoodPreviewPage-minuteBadge;

  .NeighborhoodPreviewPage-filters & {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 0.65rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    font-size: 0.75rem;
  }

  & input {
    width: 3.4rem;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
  }
`;

export const tabNavigation = css`
  label: NeighborhoodPreviewPage-tabNavigation;
  display: flex;
  margin-bottom: 0.6rem;
  padding: env(safe-area-inset-top) 0.6rem 0;
  background: white;
  border-bottom: 1px solid var(--color-border);

  & button {
    flex: 1;
    padding: 0.75rem 0.5rem;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--color-muted);
    font-weight: 650;
    cursor: pointer;
  }

  & button[aria-selected='true'] {
    border-bottom-color: var(--color-ink);
    color: var(--color-ink);
  }
`;

// 다른 요소의 선택자에서 `.NeighborhoodPreviewPage-priceNote`로 가리킨다.
export const priceNote = cx(
  css`
    label: NeighborhoodPreviewPage-priceNote;
    display: block;
    margin-top: 0.6rem;
    padding: 0.5rem;
    background: white;
    color: var(--color-muted);
    font-size: 0.65rem;
  `,
  'NeighborhoodPreviewPage-priceNote',
);

export const conditionPanel = css`
  label: NeighborhoodPreviewPage-conditionPanel;
  margin-top: 0.5rem;
  padding: 0.9rem;
  background: white;
  border-radius: 0.7rem;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
  font-size: 0.85rem;

  & > small {
    display: block;
    font-size: 0.65rem;
    color: var(--color-muted);
  }

  & .NeighborhoodPreviewPage-filters {
    box-shadow: none;
    padding: 0.6rem 0;
  }
`;

export const checks = css`
  label: NeighborhoodPreviewPage-checks;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.8rem;

  & label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
  }

  & input {
    accent-color: var(--color-primary);
  }
`;

export const modeOptions = css`
  label: NeighborhoodPreviewPage-modeOptions;
  display: grid;
  gap: 0.8rem;

  & button {
    display: grid;
    gap: 0.55rem;
    padding: 1.2rem;
    border: 1px solid var(--color-border);
    border-radius: 0.8rem;
    background: white;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  & button:hover {
    background: #fff7df;
  }

  & strong {
    font-size: 1.1rem;
  }

  & span {
    font-size: 0.8rem;
    color: var(--color-ink-soft);
  }
`;

export const backMode = css`
  label: NeighborhoodPreviewPage-backMode;
  margin-bottom: 1rem;
  border: 0;
  background: none;
  color: var(--color-muted);
  padding: 0;
  cursor: pointer;
`;

export const regionDetails = css`
  label: NeighborhoodPreviewPage-regionDetails;
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: calc(var(--map-sheet-bottom, 0px) + 10.5rem);
  padding: 1rem;
  max-width: 27rem;
  border-radius: 1rem;
  background: white;
  box-shadow: 0 3px 16px rgb(0 0 0 / 15%);
  font-size: 0.8rem;
  max-height: calc(100% - var(--map-sheet-bottom, 0px) - 15rem);
  overflow-y: auto;
  z-index: 2;

  & > button {
    float: right;
    cursor: pointer;
    border: 0;
    background: none;
    font-size: 1rem;
  }

  & small {
    display: block;
    margin-top: 0.5rem;
    color: var(--color-muted);
    font-size: 0.7rem;
  }
`;

export const stationChoices = css`
  label: NeighborhoodPreviewPage-stationChoices;
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.2rem 0 0.65rem;

  & button {
    flex: 0 0 auto;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: white;
    color: inherit;
    cursor: pointer;
  }

  & button[aria-pressed='true'] {
    border-color: var(--color-ink);
    background: var(--color-brand-yellow);
  }
`;

export const routeGuide = css`
  label: NeighborhoodPreviewPage-routeGuide;
  padding-top: 0.6rem;
  border-top: 1px solid var(--color-border);

  & ol {
    list-style: none;
    padding: 0 0 0 0.5rem;
    margin: 0.6rem 0;
    border-left: 2px solid var(--color-brand-yellow);
  }

  & li {
    display: grid;
    gap: 0.2rem;
    margin: 0 0 0.7rem 0.8rem;
  }

  & li span {
    color: var(--color-ink-soft);
  }
`;

export const retryRoute = css`
  label: NeighborhoodPreviewPage-retryRoute;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: white;
  color: inherit;
  cursor: pointer;
`;

export const railHeading = css`
  label: NeighborhoodPreviewPage-railHeading;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem 0.55rem;
  font-size: 0.8rem;

  & small {
    color: var(--color-muted);
  }
`;

export const areaCards = css`
  label: NeighborhoodPreviewPage-areaCards;
  padding: 0 0.5rem 0.5rem;
  scroll-padding-inline: 0.5rem;
`;

export const areaCard = css`
  label: NeighborhoodPreviewPage-areaCard;
  flex: 0 0 8.5rem;
`;

export const resultControls = css`
  label: NeighborhoodPreviewPage-resultControls;
  position: absolute;
  top: max(6rem, calc(env(safe-area-inset-top) + 5rem));
  left: 1rem;
  right: 1rem;
  max-width: 27rem;
  pointer-events: none;

  & button {
    pointer-events: auto;
  }
`;

export const selectedInfo = css`
  label: NeighborhoodPreviewPage-selectedInfo;
  pointer-events: auto;
  margin-top: 0.5rem;
  padding: 0.8rem;
  background: white;
  border: 1px solid #333;
  border-radius: 4px;
  font-size: 0.8rem;

  & > button {
    float: right;
    border: 0;
    background: none;
    cursor: pointer;
  }

  & p {
    font-size: 0.75rem;
  }

  & small {
    display: block;
    margin-top: 0.4rem;
    font-size: 0.7rem;
  }
`;

export const regionPicker = css`
  label: NeighborhoodPreviewPage-regionPicker;
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem;

  & button {
    border: 1px solid #333;
    background: white;
    padding: 0.4rem 0.65rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  & button[aria-pressed='true'] {
    background: var(--color-brand-yellow);
  }
`;

export const sampleNote = css`
  label: NeighborhoodPreviewPage-sampleNote;
  position: absolute;
  bottom: calc(var(--map-sheet-bottom, env(safe-area-inset-bottom)) + 0.8rem);
  left: 1rem;
  right: 1rem;
  margin: 0;
  padding: 0.5rem;
  background: rgb(255 255 255 / 92%);
  font-size: 0.6rem;
  line-height: 1.5;
  pointer-events: none;
`;

export const mapHeader = css`
  label: NeighborhoodPreviewPage-mapHeader;
  position: absolute;
  top: max(1rem, env(safe-area-inset-top));
  left: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem;
  background: white;
  border-radius: 0.8rem;
  box-shadow: 0 3px 16px rgb(0 0 0 / 10%);
  max-width: 27rem;

  & > button {
    border: 0;
    background: none;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
  }

  & span {
    font-size: 0.9rem;
    font-weight: 700;
  }

  & small {
    display: block;
    margin-top: 0.3rem;
    color: var(--color-ink-soft);
    font-size: 0.7rem;
    font-weight: 400;
  }
`;

export const searchHeader = css`
  label: NeighborhoodPreviewPage-searchHeader;
  position: absolute;
  top: max(0.75rem, env(safe-area-inset-top));
  left: 0.85rem;
  right: calc(0.85rem + var(--map-profile-space, 0px));
  z-index: 30;
  max-width: 29rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.65rem;
`;

// 다른 요소의 선택자에서 `.NeighborhoodPreviewPage-dockedHeader`로 가리킨다.
export const dockedHeader = cx(
  css`
    label: NeighborhoodPreviewPage-dockedHeader;
    top: 0;
    left: 0;
    right: 0;
    max-width: none;

    & .NeighborhoodPreviewPage-mapSearch,
    & .NeighborhoodPreviewPage-filters,
    & .NeighborhoodPreviewPage-priceNote {
      margin-left: 0.85rem;
      margin-right: 0.85rem;
      width: calc(100% - 1.7rem);
      max-width: 27.3rem;
    }
  `,
  'NeighborhoodPreviewPage-dockedHeader',
);

export const mapSearchResult = css`
  label: NeighborhoodPreviewPage-mapSearchResult;

  .NeighborhoodPreviewPage-dockedHeader & {
    margin-left: 0.85rem;
    margin-right: 0.85rem;
    width: calc(100% - 1.7rem);
    max-width: 27.3rem;
  }

  & {
    margin-top: 0.5rem;
    padding: 0.9rem;
    width: 100%;
    background: white;
    color: var(--color-ink);
    border: 1px solid var(--color-border);
    border-radius: 0.6rem;
    text-align: left;
    cursor: pointer;
  }

  &:disabled {
    color: var(--color-muted);
    cursor: default;
  }
`;

export const activeSearchField = css`
  label: NeighborhoodPreviewPage-activeSearchField;
  min-width: 0;
  height: 2.75rem;
  font-size: 0.85rem;
  background: white;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);

  &:focus-within {
    border-color: var(--color-border);
    box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
  }
`;

export const bottom = css`
  label: NeighborhoodPreviewPage-bottom;
  display: flex;
  gap: 0.5rem;
  position: absolute;
  bottom: calc(var(--map-sheet-bottom, env(safe-area-inset-bottom)) + 1rem);
  left: 1rem;
  right: 1rem;
  max-width: 27rem;
  max-height: 48dvh;
  overflow-y: auto;

  & p {
    margin: 0 0 0.8rem;
    font-size: 1rem;
    font-weight: 750;
  }

  & > small {
    display: block;
    margin-top: 0.9rem;
    font-size: 0.65rem;
    color: var(--color-muted);
    line-height: 1.5;
  }
`;

export const presets = css`
  label: NeighborhoodPreviewPage-presets;
  display: flex;
  gap: 0.5rem;

  & button {
    flex: 1;
    padding: 0.75rem 0.5rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
    color: inherit;
    font-size: 0.85rem;
  }

  & button[aria-pressed='true'] {
    background: var(--color-brand-yellow);
    border-color: var(--color-ink);
    font-weight: 700;
  }
`;

/* 휴대폰 결과 화면 위쪽 한 줄: 왼쪽 뒤로가기, 가운데 조건 배지와 색 기준, 오른쪽 다시 선택하기. */
export const resultHeader = css`
  label: NeighborhoodPreviewPage-resultHeader;
  position: absolute;
  top: max(0.75rem, env(safe-area-inset-top));
  left: 0.85rem;
  right: calc(0.85rem + var(--map-profile-space, 0px));
  display: flex;
  gap: 0.45rem;
  align-items: flex-start;
  z-index: 31;

  @media (max-width: 370px) {
    left: 0.6rem;
    right: 0.6rem;
    gap: 0.3rem;
  }
`;

export const resultReset = css`
  label: NeighborhoodPreviewPage-resultReset;
  width: 3.5rem;
  height: 3.5rem;
  padding: 0.15rem;
  font-size: 0.56rem;
  white-space: nowrap;
  flex: none;
  border-radius: 0.65rem;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);

  & > span {
    flex-direction: column;
    gap: 0.15rem;
  }
`;

export const resultCriteria = css`
  label: NeighborhoodPreviewPage-resultCriteria;
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.4rem;
`;

export const criteriaBadges = css`
  label: NeighborhoodPreviewPage-criteriaBadges;
  display: flex;
  gap: 0.3rem;
  /* 좁은 화면에서도 칩이 아래 줄로 내려가지 않게 한 줄로 두고, 넘치면 옆으로 민다. 칩 모양은 공용 Chip이 정한다. */
  overflow-x: auto;
  padding-bottom: 0.3rem;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

export const colorLegend = css`
  label: NeighborhoodPreviewPage-colorLegend;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  background: rgb(255 255 255 / 94%);
  padding: 0.4rem 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.64rem;
  font-weight: 750;
  color: var(--color-ink-soft);

  & span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  & i {
    width: 3px;
    height: 0.58rem;
    flex: none;
    border-radius: 1px;
  }
`;

export const locationStatus = css`
  label: NeighborhoodPreviewPage-locationStatus;
  position: absolute;
  top: 50%;
  right: calc(100% + 0.5rem);
  transform: translateY(-50%);
  width: max-content;
  max-width: min(15rem, calc(100vw - 6rem));
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: white;
  font-size: 0.7rem;
  color: var(--color-ink-soft);
`;

/* 통근, 환승, 월세를 한 상자의 세 칸으로 묶는다. 칸은 위에 항목, 아래에 값을 둔다. */
export const filterChips = css`
  label: NeighborhoodPreviewPage-filterChips;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 0.875rem;
  background: white;

  & button {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
    padding: 0.6rem 0.75rem;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  & button + button {
    border-left: 1px solid var(--color-border);
  }

  & button:hover,
  & button[aria-expanded='true'] {
    background: var(--color-card-surface-hover);
  }

  & button:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }
`;

export const filterCellTitle = css`
  label: NeighborhoodPreviewPage-filterCellTitle;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-muted);
  font-size: 0.7rem;
  font-weight: 500;
`;

export const filterCellValue = css`
  label: NeighborhoodPreviewPage-filterCellValue;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const emptyResult = css`
  label: NeighborhoodPreviewPage-emptyResult;
  position: absolute;
  bottom: calc(var(--map-sheet-bottom, 0px) + 1rem);
  left: 1rem;
  right: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 0.75rem;
  font-size: 0.8rem;
`;

/* 분석·실패 안내는 지도를 지우지 않고 반투명하게 덮어, 고른 위치가 뒤에 비쳐 보이게 한다. */
export const mapOverlay = css`
  label: NeighborhoodPreviewPage-mapOverlay;
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgb(255 255 255 / 78%);
  backdrop-filter: blur(2px);
`;

/* 지도 색상 기준 아래 정류장·부동산 안내. */

/* 휴대폰에서 위치를 고르면 아래에 올리는 찾기 버튼. 버튼 글자에 고른 장소 이름을 넣는다.
   공용 바텀시트처럼 태블릿(1023px까지)도 화면 폭을 채운다. 1024px부터는 데스크탑 화면이라 이 시트를 쓰지 않는다. */
export const searchCard = css`
  label: NeighborhoodPreviewPage-searchCard;
  position: absolute;
  right: 0;
  bottom: var(--map-mode-bottom, 0px);
  left: 0;
  z-index: 20;
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem 1rem calc(env(safe-area-inset-bottom) + 1rem);
  border-radius: 1.25rem 1.25rem 0 0;
  background: white;
  box-shadow: 0 -4px 18px rgb(0 0 0 / 12%);
  animation: ${searchCardRiseKeyframes} 180ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const searchCardTitle = css`
  label: NeighborhoodPreviewPage-searchCardTitle;
  margin: 0;
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 700;
`;

/* 이름이 길면 이름만 줄이고 `에서 찾기`는 남긴다. */
export const searchCardLabel = css`
  label: NeighborhoodPreviewPage-searchCardLabel;
  display: flex;
  min-width: 0;
  white-space: nowrap;

  & span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
