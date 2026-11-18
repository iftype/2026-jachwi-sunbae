import { css, cx } from '@emotion/css';

/*
 * 다른 요소의 선택자에서 `.PropertyAppLayout-root`로 가리킨다.
 * css 템플릿 안의 주석은 그대로 main 번들에 실리므로, 첫 화면부터 쓰는 이 셸의 설명은 템플릿 밖에 둔다.
 * 지도 화면은 휴대폰 폭 기준(--app-max-width)보다 넓은 휴대폰에서도 양옆 빈칸 없이 화면을 채운다.
 * 체크리스트 편집은 휴대폰 기준 폭(--app-max-width)보다 넓은 휴대폰에서도 양옆 빈칸 없이 채운다. 아래 고정 버튼도 같은 폭을 따른다.
 * 카드형 홈 시안 셸: 바텀탭 대신 상단 홈 버튼으로 시안 홈에 돌아간다.
 * 카드형 홈과 같은 테두리 없는 회색 카드로 기존 화면의 표면을 맞춘다.
 * 매물 목록·상세는 이미 시안에 맞춘 화면이고 지도는 시트가 지도 위에 떠야 하므로 표면을 흰색으로 둔다.
 * 지도 화면은 휴대폰 폭(24.375rem) 열에 가두지 않고 창 크기와 상관없이 화면 전체를 쓴다.
 * 마이는 홈처럼 휴대폰 폭(24.375rem)에 가두지 않고, 화면 안에서 본문 폭(휴대폰 45rem·데스크탑 64rem)을 정한다.
 * 태블릿부터는 휴대폰 폭에 가두지 않는다. 지도가 아닌 화면은 48rem 폭 가운데 열로 넓힌다. 화면 아래 고정 버튼도 같은 폭(--app-max-width)을 따른다.
 * 지도가 아닌 앱 화면(체크리스트·방 비교·마이·매물 화면 등)은 휴대폰 기준 글자가 넓은 화면에서 너무 작아 보이므로, 이 화면이 열려 있는 동안 기준 글자 크기(rem)를 태블릿부터 112.5%로 올려 글자와 여백을 같은 비율로 키운다(데스크탑 셸은 125%).
 */
export const root = cx(
  css`
    label: PropertyAppLayout-root;
    position: relative;
    width: min(100%, var(--app-max-width));
    height: 100dvh;
    margin: 0 auto;
    overflow: hidden;
    background: var(--color-canvas);

    &[data-map-page='true'] {
      width: 100%;
    }

    @media (min-width: 431px) {
      box-shadow: 0 0 2rem rgb(59 52 36 / 8%);
    }

    @media (max-width: 767px) {
      &[data-wide-property-page='true'] {
        width: 100%;
      }
    }

    @media (max-width: 767px) {
      &[data-wide-page='true'] {
        --app-max-width: 100vw;
        width: 100%;
      }
    }

    &[data-design-shell='true'] {
      display: flex;
      flex-direction: column;
      --bottom-navigation-height: 0px;
      --color-surface: #f1f2f4;
      --color-border: transparent;
      --radius-md: 1rem;
      --radius-lg: 1.15rem;
    }

    &[data-design-shell='true'][data-wide-property-page='true'],
    &[data-design-shell='true'][data-map-page='true'] {
      --color-surface: #fff;
      --color-border: #eaebed;
    }

    &[data-design-shell='true'][data-map-page='true'] {
      width: 100%;
    }

    &[data-design-shell='true'][data-home-width-page='true'] {
      width: 100%;
    }

    @media (min-width: 768px) {
      &[data-design-shell='true'] {
        --app-max-width: 48rem;
        width: min(100%, var(--app-max-width));
        box-shadow: none;
      }
    }

    @media (min-width: 768px) {
      html:has(&[data-design-shell='true']:not([data-map-page='true'])) {
        font-size: 112.5%;
      }
    }
  `,
  'PropertyAppLayout-root',
);

/*
 * 상단에서 당기는 모바일 새로고침이 내부 스크롤러에 막히지 않게 한다.
 */
export const content = css`
  label: PropertyAppLayout-content;
  position: relative;
  z-index: 0;
  width: 100%;
  height: 100%;
  padding-bottom: calc(var(--bottom-navigation-height) + 1.1rem + env(safe-area-inset-bottom));
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: auto;
  scrollbar-width: none;

  .PropertyAppLayout-root[data-full-screen='true'] & {
    padding-bottom: 0;
  }

  .PropertyAppLayout-root[data-map-page='true'] & {
    --map-sheet-bottom: calc(var(--bottom-navigation-height) + 1.1rem + env(safe-area-inset-bottom));
    padding-bottom: 0;
    overflow: hidden;
  }

  &::-webkit-scrollbar {
    display: none;
  }

  .PropertyAppLayout-root[data-design-shell='true'] & {
    flex: 1;
    min-height: 0;
    padding-bottom: var(--mobile-tab-space, env(safe-area-inset-bottom));
  }

  /* 체크리스트 목록은 전체 화면 셸이지만 하단 탭이 보이는 동안은 그만큼 비운다. */
  .PropertyAppLayout-root[data-design-shell='true'][data-full-screen='true'] & {
    padding-bottom: var(--mobile-tab-space, 0px);
  }

  .PropertyAppLayout-root[data-design-shell='true'][data-map-page='true'] & {
    --map-sheet-bottom: env(safe-area-inset-bottom);
    padding-bottom: 0;
  }
`;
