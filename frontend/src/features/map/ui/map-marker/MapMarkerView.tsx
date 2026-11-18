import { css, cx, keyframes } from '@emotion/css';
import { renderToStaticMarkup } from 'react-dom/server';

import { mapCategoryMarkerSrc, propertyMarkerSrc } from '../../lib/mapIconAssets';
import { isPinMarker } from '../../lib/mapMarkerPresentation';
import type { MapMarker } from '../../model/Map';

type MapMarkerViewProps = {
  marker: MapMarker;
  selectedMarkerId?: string | null;
  onSelectMarker?: (marker: MapMarker) => void;
};

const markerSymbol = (marker: MapMarker): string => {
  if (marker.tone === 'cluster' || marker.tone === 'propertyCluster') return String(marker.count ?? '');
  return '•';
};

/** 현재 위치는 지도 앱 관례대로 글리프 없는 파란 점 하나로 그린다. */
const isCurrentLocationDot = (marker: MapMarker): boolean => marker.tone === 'current';

/** 시설 마커는 카테고리 핀을, 매물 마커는 집 핀을 쓴다. */
const pinImageSrc = (marker: MapMarker): string =>
  marker.category !== undefined && (marker.tone === 'place' || marker.tone === 'cluster')
    ? mapCategoryMarkerSrc(marker.category, marker.variant)
    : propertyMarkerSrc;

/** 군집은 핀 오른쪽 위 숫자 배지로 개별 마커와 구분한다. 겹친 매물 군집은 매물 핀 그대로에 배지를 단다. */
const usesCountBadge = (marker: MapMarker): boolean => marker.count !== undefined && marker.category !== undefined;

const markerClassName = (marker: MapMarker, selectedMarkerId: string | null | undefined): string =>
  [
    styles.marker,
    isPinMarker(marker) ? styles.pinMarker : '',
    marker.image ? styles.imageMarker : '',
    marker.photo !== undefined && (marker.tone === 'property' || marker.tone === 'propertyCluster')
      ? styles.photoMarker
      : '',
    marker.appear ? styles.appearMarker : '',
    marker.pop ? styles.popMarker : '',
    marker.tone === 'property' || marker.tone === 'propertyCluster' ? styles.propertyMarker : '',
    marker.tone === 'current' ? styles.currentMarker : '',
    marker.tone === 'dot' ? styles.dotMarker : '',
    marker.tone === 'selected' ? styles.selectedMarker : '',
    marker.tone === 'destination' || marker.tone === 'flash' ? styles.destinationMarker : '',
    marker.tone === 'rank' ? styles.rankMarker : '',
    marker.tone === 'flash' ? styles.flashMarker : '',
    marker.tone === 'place' ? styles.placeMarker : '',
    marker.tone === 'cluster' ? styles.clusterMarker : '',
    selectedMarkerId === marker.id ? styles.activeMarker : '',
  ]
    .filter(Boolean)
    .join(' ');

/** 지도 SDK와 데모 지도 양쪽에서 재사용하는 마커의 순수 시각 UI. */
const MapMarkerView = ({ marker, selectedMarkerId = null, onSelectMarker }: MapMarkerViewProps) => {
  const canSelect = marker.actionable === true && onSelectMarker !== undefined;
  const isPhotoMarker = marker.photo !== undefined && (marker.tone === 'property' || marker.tone === 'propertyCluster');
  const markerContent = (
    <>
      {marker.summary && !isPhotoMarker && (
        <span className={styles.markerSummaryCard}>
          <strong title={marker.label}>{marker.label}</strong>
          <small title={marker.summary.amount}>{marker.summary.amount}</small>
        </span>
      )}
      {marker.image ? (
        <img
          className={styles.pinImage}
          src={marker.image.src}
          srcSet={marker.image.src2x ? `${marker.image.src} 1x, ${marker.image.src2x} 2x` : undefined}
          alt=""
          draggable={false}
          decoding="async"
        />
      ) : marker.tone === 'rank' ? (
        <span className={styles.rankLabel}>
          <b>{marker.rank}</b>
          {marker.caption ?? marker.label}
        </span>
      ) : marker.tone === 'destination' || marker.tone === 'flash' ? (
        <>
          <span className={styles.destinationLabel}>
            {marker.tally ? (
              <>
                {marker.tally.positive > 0 && <span data-variant="positive">👍 {marker.tally.positive}</span>}
                {marker.tally.negative > 0 && <span data-variant="negative">👎 {marker.tally.negative}</span>}
              </>
            ) : (
              marker.label
            )}
          </span>
          <span className={styles.destinationTail} aria-hidden="true" />
        </>
      ) : isPhotoMarker ? (
        // 사진 오른쪽에 이름과 월세를 두 줄로 붙인 파란 카드. 흰 바탕과 테두리는 두지 않는다.
        <span className={styles.photoCard} data-has-text={marker.summary ? '' : undefined}>
          <img className={styles.photoPin} src={marker.photo} alt="" draggable={false} decoding="async" />
          {/* 겹친 매물은 사진 카드 오른쪽 위 모서리에 걸친 흰 배지에 파란 숫자로 개수를 적는다. */}
          {marker.count !== undefined && <strong className={styles.photoCount}>{marker.count}</strong>}
          {marker.summary && (
            <span className={styles.photoText}>
              <strong title={marker.label}>{marker.label}</strong>
              <small title={marker.summary.amount}>{marker.summary.amount}</small>
            </span>
          )}
        </span>
      ) : isCurrentLocationDot(marker) || marker.tone === 'dot' ? null : isPinMarker(marker) ? (
        <img className={styles.pinImage} src={pinImageSrc(marker)} alt="" draggable={false} decoding="async" />
      ) : (
        <span className={styles.markerIcon} aria-hidden="true">
          {markerSymbol(marker)}
        </span>
      )}
      {usesCountBadge(marker) && !isPhotoMarker && <strong className={styles.markerCount}>{marker.count}</strong>}
    </>
  );
  const commonProps = {
    className: markerClassName(marker, selectedMarkerId),
    'data-tone': marker.tone ?? 'property',
    'data-category': marker.category,
    'data-variant': marker.variant,
    'data-tally': marker.tally ? '' : undefined,
    'data-rank': marker.rank,
    'aria-label': marker.label,
    style:
      marker.pop || marker.color
        ? {
            ...(marker.pop && { animationDelay: `${marker.pop.delayMs}ms` }),
            ...(marker.tone === 'dot' && marker.color && { background: marker.color }),
          }
        : undefined,
  };

  if (!canSelect)
    return (
      <div {...commonProps} role="img">
        {markerContent}
      </div>
    );

  return (
    <button
      {...commonProps}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelectMarker(marker);
      }}
    >
      {markerContent}
    </button>
  );
};

/** Naver overlay가 요구하는 HTMLElement로 동일한 마커 UI를 변환한다. */
export const createMapMarkerElement = (
  marker: MapMarker,
  selectedMarkerId: string | null,
  onSelectMarker?: (marker: MapMarker) => void,
): HTMLElement => {
  const template = document.createElement('template');
  template.innerHTML = renderToStaticMarkup(
    <MapMarkerView marker={marker} selectedMarkerId={selectedMarkerId} onSelectMarker={onSelectMarker} />,
  );
  // React의 이미지 preload 링크가 마커 앞에 생성될 수 있으므로 첫 요소를 사용하지 않는다.
  const element = template.content.querySelector('[data-tone]');
  if (!(element instanceof HTMLElement)) throw new Error('지도 마커를 만들지 못했습니다.');

  if (marker.actionable === true && onSelectMarker !== undefined) {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelectMarker(marker);
    });
  }
  return element;
};

const markerFlashKeyframes = keyframes`
  0% {
    opacity: 0;
    translate: 0 0.5rem;
  }
  12% {
    opacity: 1;
    translate: 0 0;
  }
  70% {
    opacity: 1;
    translate: 0 -0.6rem;
  }
  100% {
    opacity: 0;
    translate: 0 -2rem;
  }
`;

const markerAppearKeyframes = keyframes`
  from {
    opacity: 0;
    translate: 0 0.9rem;
    scale: 0.85;
  }
  60% {
    opacity: 1;
    translate: 0 -0.2rem;
    scale: 1.03;
  }
  to {
    opacity: 1;
    translate: 0 0;
    scale: 1;
  }
`;

const markerPopKeyframes = keyframes`
  0% {
    opacity: 0;
    scale: 0.3;
  }
  55% {
    opacity: 1;
    scale: 1.12;
  }
  78% {
    scale: 0.96;
  }
  100% {
    opacity: 1;
    scale: 1;
  }
`;

const markerFlashFadeKeyframes = keyframes`
  0%,
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
`;

const styles = {
  marker: css`
    label: MapMarkerView-marker;
    position: relative;
    display: grid;
    width: 1.55rem;
    height: 1.55rem;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    border: 2px solid white;
    border-radius: 50%;
    background: #64748b;
    box-shadow: none;
    color: white;
    cursor: default;
    place-items: center;

    button& {
      cursor: pointer;
    }

    /* WebView에서 지도 이동 중 DOM 마커의 그림자·캡션 합성 비용을 줄인다. */
    [data-map-gesture='true'] & {
      box-shadow: none;
      filter: none;
    }
  `,

  /* 핀 이미지가 모양과 색을 모두 담으므로 기본 원형 배경과 테두리를 지운다. 아래 꼭짓점이 좌표를 가리킨다. */
  // 다른 요소의 선택자에서 `.MapMarkerView-pinMarker`로 가리킨다.
  pinMarker: cx(
    css`
      label: MapMarkerView-pinMarker;

      & {
        width: 2rem;
        height: 2rem;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        filter: none;
        transform-origin: 50% 100%;
      }
    `,
    'MapMarkerView-pinMarker',
  ),

  /* 새로 생긴 마커는 꼬리 끝을 축으로 아래에서 떠오르며 나타난다. */
  appearMarker: css`
    label: MapMarkerView-appearMarker;
    transform-origin: 50% 100%;
    animation: ${markerAppearKeyframes} 560ms cubic-bezier(0.22, 1, 0.36, 1) both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,

  /* 메모 말풍선은 꼬리 끝을 축으로 작게 시작해 통통 튀어나온다. 나타난 뒤에는 움직이지 않아 누르기 쉽다. */
  popMarker: css`
    label: MapMarkerView-popMarker;
    transform-origin: 50% 100%;
    animation: ${markerPopKeyframes} 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,

  /* 그림 핀은 기호가 작아 보이지 않게 일반 핀보다 조금 크게 그린다. */
  imageMarker: css`
    label: MapMarkerView-imageMarker;

    && {
      width: 2.5rem;
      height: 2.5rem;
    }
  `,

  pinImage: css`
    label: MapMarkerView-pinImage;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  `,

  /* 대표 사진이 있는 매물 마커: 사진을 모서리 둥근 네모로 잘라 흰 테두리와 파란 고리로 두른다. */
  photoMarker: css`
    label: MapMarkerView-photoMarker;

    /* 지도 SDK의 오버레이 칸은 폭이 0에 가깝게 잡혀, 폭이 auto면 마커가 가장 좁은 폭으로 줄어 글자가 잘린다. 내용 폭을 그대로 쓴다. */
    &&& {
      width: max-content;
      height: auto;
      min-width: 0;
      padding-bottom: 0.75rem;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;

      /* 사진, 글자, 꼬리가 한꺼번에 같은 배율로 커지고 작아지게 마커 전체를 꼬리 끝(아래 가운데)을 기준으로 줄인다. */
      scale: var(--map-marker-scale, 1);
      transform-origin: 50% 100%;
    }

    /* 고른 마커는 배율에 1.12배를 더 곱한다. */
    &&&.MapMarkerView-activeMarker {
      scale: calc(var(--map-marker-scale, 1) * 1.12);
    }

    /* 카드 아래 가운데에 붙는 파란 꼬리(핀). 카드 안쪽으로 겹쳐 붙이고 그림자를 줘서 따로 떠 보이지 않게 한다. 꼭짓점이 지도 좌표를 가리킨다. */
    &::after {
      position: absolute;
      bottom: 0;
      left: 50%;
      width: 0;
      height: 0;
      border-top: 0.5rem solid #3f82f7;
      border-right: 0.38rem solid transparent;
      border-left: 0.38rem solid transparent;
      content: '';
      filter: drop-shadow(0 1px 1px rgb(0 0 0 / 18%));
      transform: translateX(-50%);
    }
  `,

  /* 사진은 테두리 없이 카드 왼쪽 끝에 붙이고, 이름과 월세는 흰 바탕에 파란 글씨로 둔다. 글이 없는 겹친 매물은 사진만 둔다. */
  photoCard: css`
    label: MapMarkerView-photoCard;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    position: relative;
    width: max-content;
    padding: 0;
    border-radius: 0.9rem;
    background: transparent;
    color: #3f82f7;
    white-space: nowrap;

    &[data-has-text] {
      padding-right: 0.8rem;
      background: #fff;
      box-shadow: 0 1px 5px rgb(0 0 0 / 18%);
    }
  `,

  photoCount: css`
    label: MapMarkerView-photoCount;
    position: absolute;
    top: -0.55rem;
    right: -0.55rem;
    display: grid;
    min-width: 1.45rem;
    height: 1.45rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 0 0 2px #3f82f7;
    color: #3f82f7;
    font-size: 0.78rem;
    font-weight: 850;
    line-height: 1;
    place-items: center;
  `,

  photoPin: css`
    label: MapMarkerView-photoPin;
    display: block;
    flex: none;
    width: 2.8rem;
    height: 2.8rem;
    border-radius: 0.9rem;
    background: #e5e7ea;

    /* 글이 붙은 카드에서는 사진이 카드 왼쪽 끝에 맞닿으므로 오른쪽 모서리는 직각이다. */
    [data-has-text] > & {
      border-radius: 0.9rem 0 0 0.9rem;
    }
    object-fit: cover;
    pointer-events: none;
  `,

  /* 사진 오른쪽의 이름(위)과 월세(아래). 숫자가 길어도 카드가 넓어지지 않게 줄인다. */
  photoText: css`
    label: MapMarkerView-photoText;
    display: grid;
    max-width: 8.5rem;
    gap: 0.1rem;
    text-align: left;

    & strong,
    & small {
      overflow: hidden;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & strong {
      color: #1f2328;
      font-size: 0.8rem;
      font-weight: 750;
    }

    & small {
      color: #7a828c;
      font-size: 0.72rem;
      font-weight: 600;
    }
  `,

  placeMarker: css`
    label: MapMarkerView-placeMarker;

    button&::before {
      position: absolute;
      inset: -0.55rem;
      content: '';
    }

    & {
      z-index: 5;
    }
  `,

  /* 카테고리가 없는 군집만 숫자를 담은 어두운 원으로 그린다. 카테고리 군집은 핀과 숫자 배지로 그린다. */
  clusterMarker: css`
    label: MapMarkerView-clusterMarker;

    button&::before {
      position: absolute;
      inset: -0.55rem;
      content: '';
    }

    & {
      z-index: 5;
      width: 1.95rem;
      height: 1.95rem;
      background: #212124;
      box-shadow: 0 0 0 0.22rem rgb(0 0 0 / 12%);
    }

    &.MapMarkerView-pinMarker {
      width: 2.3rem;
      height: 2.3rem;
      background: transparent;
      box-shadow: none;
    }
  `,

  // 다른 요소의 선택자에서 `.MapMarkerView-propertyMarker`로 가리킨다.
  propertyMarker: cx(
    css`
      label: MapMarkerView-propertyMarker;

      & {
        z-index: 8;
        width: calc(2.35rem * var(--map-marker-scale, 1));
        height: calc(2.35rem * var(--map-marker-scale, 1));
      }
    `,
    'MapMarkerView-propertyMarker',
  ),

  markerSummaryCard: css`
    label: MapMarkerView-markerSummaryCard;
    position: absolute;
    z-index: 3;
    left: 50%;
    bottom: calc(100% + 0.45rem);
    display: grid;
    box-sizing: border-box;
    width: 6.5rem;
    height: 2.8rem;
    padding: 0.3rem 0.25rem;
    overflow: hidden;
    border: 1px solid #d8dbe0;
    border-radius: 1.05rem;
    background: #fff;
    box-shadow: none;
    color: #25282d;
    text-align: center;
    transform: translateX(-50%);

    /* 카드는 마커 버튼 안에 있으므로, 카드를 눌러도 그 매물을 고른다. */
    button & {
      cursor: pointer;
    }

    &::after {
      position: absolute;
      bottom: -0.6rem;
      left: calc(50% - 0.3rem);
      width: 0.55rem;
      height: 0.55rem;
      border-right: 1px solid #d8dbe0;
      border-bottom: 1px solid #d8dbe0;
      background: #fff;
      content: '';
      transform: rotate(45deg);
    }

    & strong,
    & small {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & strong {
      font-size: 0.78rem;
      font-weight: 600;
      line-height: 1.3;
    }

    & small {
      color: #626975;
      font-size: 0.66rem;
      line-height: 1.3;
    }
  `,

  selectedMarker: css`
    label: MapMarkerView-selectedMarker;
    z-index: 9;
    width: calc(2.6rem * var(--map-marker-scale, 1));
    height: calc(2.6rem * var(--map-marker-scale, 1));
  `,

  // 다른 요소의 선택자에서 `.MapMarkerView-activeMarker`로 가리킨다.
  activeMarker: cx(
    css`
      label: MapMarkerView-activeMarker;

      & {
        outline: 1px solid #212124;
        outline-offset: 2px;
        scale: 1.08;
      }

      /* 핀은 테두리 대신 아래 꼭짓점을 기준으로 조금 키워 고른 것을 보여준다. */
      &.MapMarkerView-pinMarker {
        outline: 0;
        scale: 1.15;
      }
    `,
    'MapMarkerView-activeMarker',
  ),

  /* 현재 위치는 지도 앱 관례대로 파란 점으로 그린다. */
  currentMarker: css`
    label: MapMarkerView-currentMarker;
    z-index: 7;
    width: 1.15rem;
    height: 1.15rem;
    border: 3px solid white;
    border-radius: 50%;
    background: #1a73e8;
    box-shadow: 0 0 0 0.45rem rgb(26 115 232 / 16%);
  `,

  /* 시설을 아이콘 없이 작은 색 점으로 그린다. 색은 marker.color로 준다. */
  dotMarker: css`
    label: MapMarkerView-dotMarker;
    /* 기본 마커의 흰 테두리를 확실히 덮도록 선택자를 겹친다. */
    && {
      width: 0.4rem;
      height: 0.4rem;
      border: 0;
      border-radius: 50%;
      box-shadow: none;
    }
  `,

  markerCount: css`
    label: MapMarkerView-markerCount;

    & {
      position: absolute;
      right: -0.28rem;
      bottom: -0.28rem;
      display: grid;
      min-width: 0.92rem;
      height: 0.92rem;
      padding: 0 0.2rem;
      border: 2px solid white;
      border-radius: 999px;
      background: #252a23;
      color: white;
      font-size: 0.46rem;
      place-items: center;
    }

    /* 핀 군집은 둥근 머리 오른쪽 위에 배지를 단다. */
    .MapMarkerView-pinMarker & {
      top: -0.25rem;
      right: -0.35rem;
      bottom: auto;
      min-width: 1.2rem;
      height: 1.2rem;
      /* 매물 군집 배지는 흰 바탕에 파란 숫자와 파란 고리로, 파란 카드 위에서도 잘 보이게 한다. */
      top: -0.55rem;
      right: -0.55rem;
      min-width: 1.45rem;
      height: 1.45rem;
      border: 0;
      background: #fff;
      box-shadow: 0 0 0 2px #3f82f7;
      color: #3f82f7;
      font-size: 0.78rem;
      font-weight: 850;
    }
  `,

  markerIcon: css`
    label: MapMarkerView-markerIcon;
    font-size: 0.78rem;
    font-weight: 900;
    line-height: 1;
  `,

  markerCaption: css`
    label: MapMarkerView-markerCaption;
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 50%;
    padding: 0.15rem 0.45rem;
    border: 1px solid var(--color-border, #eaebed);
    border-radius: var(--radius-sm, 0.35rem);
    background: rgb(255 255 255 / 96%);
    box-shadow: none;
    color: var(--color-ink, #212124);
    font-size: 0.68rem;
    font-weight: 750;
    line-height: 1.25;
    text-align: center;
    white-space: nowrap;
    transform: translateX(-50%);
    pointer-events: none;

    [data-map-gesture='true'] & {
      visibility: hidden;
    }
  `,

  /* 고른 장소(동네 찾기 목적지)는 이름이 든 말풍선 핀으로 그린다. 아래 꼬리 끝이 좌표를 가리킨다. */
  destinationMarker: css`
    label: MapMarkerView-destinationMarker;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: auto;
    height: auto;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    filter: none;

    /* 말풍선(거리 메모 등)은 눌러도 테두리를 두지 않는다. 고른 메모는 옆 칸이나 시트에서 보여 준다. */
    &.MapMarkerView-activeMarker {
      outline: 0;
      scale: 1;
    }

    /*
     * 거리 메모 말풍선은 가로로 길게 두고 두 줄까지 보여 준다. 넘치면 둘째 줄 끝을 줄인다.
     * 색 바탕 위 흰 글자가 뭉개지지 않게 굵기를 한 단계 낮추고 줄 간격과 안쪽 여백을 넉넉히 둔다.
     */
    &[data-category='MEMO'] .MapMarkerView-destinationLabel {
      display: -webkit-box;
      /* 지도 겹 안의 마커는 폭이 좁게 잡혀 짧은 글도 접히므로, 글 길이만큼 펴고 최대 폭에서만 줄을 바꾼다. */
      width: max-content;
      max-width: min(22rem, 75vw);
      padding: 0.45rem 0.9rem;
      border-radius: 0.8rem;
      font-size: 0.82rem;
      font-weight: 600;
      line-height: 1.45;
      letter-spacing: -0.01em;
      text-align: center;
      white-space: normal;
      word-break: keep-all;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    /* 거리 메모 말풍선은 좋아요(positive)를 옅은 파랑, 싫어요(negative)를 옅은 빨강으로 칠하고 진한 같은 계열 글자를 올린다. */
    &[data-variant='positive'] .MapMarkerView-destinationLabel,
    &[data-tally] .MapMarkerView-destinationLabel [data-variant='positive'] {
      background: var(--color-memo-like, #cfe2fa);
      color: var(--color-memo-like-ink, #24497f);
    }

    &[data-variant='positive'] .MapMarkerView-destinationTail {
      border-top-color: var(--color-memo-like, #cfe2fa);
    }

    &[data-variant='negative'] .MapMarkerView-destinationLabel,
    &[data-tally] .MapMarkerView-destinationLabel [data-variant='negative'] {
      background: var(--color-memo-dislike, #f7cfcf);
      color: var(--color-memo-dislike-ink, #8a2c2c);
    }

    &[data-variant='negative'] .MapMarkerView-destinationTail {
      border-top-color: var(--color-memo-dislike, #f7cfcf);
    }

    /* 거리 메모는 멀리 축소할수록 작게 그려, 넓은 화면에 큰 말풍선이 빽빽하게 덮지 않게 한다. 꼬리 끝(아래 가운데)을 기준으로 줄인다. */
    &[data-category='MEMO'] {
      scale: var(--map-marker-scale, 1);
      transform-origin: 50% 100%;
    }

    /* 겹친 메모 묶음은 글 대신 좋아요·싫어요 칸을 반반 나란히 두고 👍·👎와 개수를 적는다. 바탕은 칸이 칠한다. */
    &[data-tally] .MapMarkerView-destinationLabel {
      display: flex;
      padding: 0;
      background: transparent;
      font-weight: 700;
      white-space: nowrap;
    }

    &[data-tally] .MapMarkerView-destinationLabel > span {
      flex: 1;
      min-width: 2.2rem;
      padding: 0.4rem 0.7rem;
      text-align: center;
    }

    /* 데스크탑은 화면이 넓어 묶음 말풍선이 작아 보이므로 칸과 글자를 키운다. */
    @media (min-width: 1024px) {
      &[data-tally] .MapMarkerView-destinationLabel {
        font-size: 1.05rem;
      }

      &[data-tally] .MapMarkerView-destinationLabel > span {
        min-width: 3rem;
        padding: 0.6rem 1rem;
      }
    }
  `,

  /* 순위 알약은 동네 가운데에 띄운다. 바탕 없는 틀만 두고 모양은 안쪽 알약이 맡는다. */
  rankMarker: css`
    label: MapMarkerView-rankMarker;
    width: auto;
    height: auto;
    border: 0;
    border-radius: 999px;
    background: transparent;
    box-shadow: none;
    filter: none;

    &.MapMarkerView-activeMarker {
      outline: 0;
      scale: 1.08;
    }
  `,

  /* 앞쪽 파란 동그라미에 순위를, 뒤에 동네 이름을 둔다. 1위는 강조색으로 채운다. */
  rankLabel: css`
    label: MapMarkerView-rankLabel;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem 0.2rem 0.2rem;
    border: 1px solid #dfe3ea;
    border-radius: 999px;
    background: white;
    color: var(--color-ink, #25282d);
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;

    & > b {
      display: grid;
      width: 1.3rem;
      height: 1.3rem;
      place-items: center;
      border-radius: 50%;
      background: #3d6fe8;
      color: white;
      font-size: 0.72rem;
    }

    [data-rank='1'] > & > b {
      background: #f5b417;
    }
  `,

  // 다른 요소의 선택자에서 `.MapMarkerView-destinationLabel`로 가리킨다.
  destinationLabel: cx(
    css`
      label: MapMarkerView-destinationLabel;
      max-width: 11rem;
      padding: 0.45rem 0.75rem;
      overflow: hidden;
      border-radius: 999px;
      background: var(--color-ink, #25282d);
      color: white;
      font-size: 0.78rem;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      text-overflow: ellipsis;
    `,
    'MapMarkerView-destinationLabel',
  ),

  // 다른 요소의 선택자에서 `.MapMarkerView-destinationTail`로 가리킨다.
  destinationTail: cx(
    css`
      label: MapMarkerView-destinationTail;
      width: 0;
      height: 0;
      margin-top: -1px;
      border-top: 0.45rem solid var(--color-ink, #25282d);
      border-right: 0.4rem solid transparent;
      border-left: 0.4rem solid transparent;
    `,
    'MapMarkerView-destinationTail',
  ),

  /* 방금 남긴 메모처럼 잠깐 알리는 말풍선. 그 자리에서 떠오르며 사라진다. */
  flashMarker: css`
    label: MapMarkerView-flashMarker;
    pointer-events: none;
    animation: ${markerFlashKeyframes} 2.4s ease-out forwards;

    & .MapMarkerView-destinationLabel {
      max-width: 14rem;
      background: var(--color-brand-blue, #6b9ae6);
    }

    & .MapMarkerView-destinationTail {
      border-top-color: var(--color-brand-blue, #6b9ae6);
    }

    @media (prefers-reduced-motion: reduce) {
      animation: ${markerFlashFadeKeyframes} 2.4s linear forwards;
    }
  `,
};

export default MapMarkerView;
