import { css, keyframes } from '@emotion/css';

import type { MapTip } from '../../model/MapCanvas';

const appear = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, 0.5rem);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
`;

const appearBelow = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -0.5rem);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
`;

const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgb(37 99 235 / 45%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 14px rgb(37 99 235 / 0%);
  }
`;

const styles = {
  /* 좌표에 놓이는 0 크기 상자. 점은 좌표 위에, 말풍선은 점 위에 얹는다. */
  anchor: css`
    label: MapTip-anchor;
    position: relative;
    width: 0;
    height: 0;
    /* 좌표 아래 지도 클릭은 그대로 지도로 흘려보내고, 말풍선만 누를 수 있다. */
    pointer-events: none;
  `,
  dot: css`
    label: MapTip-dot;
    position: absolute;
    top: -6px;
    left: -6px;
    width: 12px;
    height: 12px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--color-brand-blue-ink, #2563eb);
    animation: ${pulse} 1.6s ease-out infinite;
    box-sizing: border-box;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
  bubble: css`
    label: MapTip-bubble;
    position: absolute;
    bottom: 16px;
    left: 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-sizing: border-box;
    width: max-content;
    max-width: min(20rem, calc(100vw - 2rem));
    padding: 0.9rem 1.1rem;
    border: 1px solid color-mix(in srgb, var(--color-brand-blue-ink, #2563eb) 20%, transparent);
    border-radius: var(--radius-sm, 0.5rem);
    background: #fff;
    color: var(--color-brand-blue-ink, #2563eb);
    box-shadow: 0 2px 10px rgb(0 0 0 / 14%);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.55;
    word-break: keep-all;
    animation: ${appear} 200ms ease-out both;
    transform: translateX(-50%);
    pointer-events: auto;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    &[data-placement='below'] {
      top: 16px;
      bottom: auto;
      animation-name: ${appearBelow};
    }

    /* 꼬리 화살표: 아래 가운데에서 점을 가리킨다. */
    &::after {
      content: '';
      position: absolute;
      bottom: -0.4rem;
      left: calc(50% - 0.4rem);
      width: 0.8rem;
      height: 0.8rem;
      border-right: 1px solid color-mix(in srgb, var(--color-brand-blue-ink, #2563eb) 20%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--color-brand-blue-ink, #2563eb) 20%, transparent);
      background: #fff;
      transform: rotate(45deg);
    }

    &[data-placement='below']::after {
      top: -0.4rem;
      bottom: auto;
      border: 0;
      border-top: 1px solid color-mix(in srgb, var(--color-brand-blue-ink, #2563eb) 20%, transparent);
      border-left: 1px solid color-mix(in srgb, var(--color-brand-blue-ink, #2563eb) 20%, transparent);
    }
  `,
  action: css`
    label: MapTip-action;
    flex: none;
    min-height: 2.25rem;
    padding: 0 1rem;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-brand-blue-ink, #2563eb) 10%, #fff);
    color: var(--color-brand-blue-ink, #2563eb);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 800;
    cursor: pointer;
  `,
};

/**
 * 지도 좌표에 붙는 첫 안내 말풍선. 좌표에 맥박처럼 깜빡이는 파란 점을 두고, 그 위에 말풍선(꼬리가 점을 가리킴)과 `확인`을 올린다.
 * 지도 SDK 오버레이에 넣을 DOM이라 React 밖에서 직접 만든다. 말풍선 위 누름은 지도로 번지지 않는다.
 */
export const createMapTipElement = (tip: MapTip): HTMLElement => {
  const anchor = document.createElement('div');
  anchor.className = styles.anchor;
  const dot = document.createElement('span');
  dot.className = styles.dot;
  const bubble = document.createElement('div');
  bubble.className = styles.bubble;
  bubble.setAttribute('role', 'note');
  if (tip.placement === 'below') bubble.dataset.placement = 'below';
  const message = document.createElement('span');
  message.textContent = tip.message;
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = styles.action;
  confirm.textContent = '확인';
  confirm.addEventListener('click', (event) => {
    event.stopPropagation();
    tip.onConfirm();
  });
  bubble.append(message, confirm);
  ['click', 'pointerdown', 'mousedown', 'touchstart', 'dblclick'].forEach((type) =>
    bubble.addEventListener(type, (event) => event.stopPropagation()),
  );
  anchor.append(dot, bubble);
  return anchor;
};
