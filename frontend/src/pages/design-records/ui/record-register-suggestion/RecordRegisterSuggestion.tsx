import { css, keyframes } from '@emotion/css';
import { useEffect } from 'react';

/** 제안이 떠 있는 시간. 닫기 버튼이 없어 이 시간이 지나면 스스로 사라진다. */
const SUGGESTION_DURATION_MS = 6000;

type RecordRegisterSuggestionProps = {
  /** 제안을 띄울지. 현재 위치로 이동한 뒤 그 자리에 기록한 매물이 없을 때 켠다. */
  isOpen: boolean;
  onAccept: () => void;
  onClose: () => void;
  className?: string;
};

/**
 * 현재 위치로 이동했을 때 "여기서 매물을 추가할까요?"를 묻는 토스트. 추가를 누르면 그 위치로 등록을 시작한다.
 * 아래에서 올라와 머물다가 다시 내려가고, 시간이 지나면 닫힌다. 같은 제안이 떠 있는 동안 다시 와도 하나만 보인다.
 */
const RecordRegisterSuggestion = ({ isOpen, onAccept, onClose, className }: RecordRegisterSuggestionProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(onClose, SUGGESTION_DURATION_MS);
    return () => window.clearTimeout(timer);
    // onClose는 렌더마다 새로 만들어지므로 열림이 바뀔 때만 시간을 다시 잰다.
  }, [isOpen]);

  return isOpen ? (
    <div className={`${styles.toast} ${className ?? ''}`.trim()} role="status">
      <span>현재 위치에서 매물을 추가할까요?</span>
      <button type="button" onClick={onAccept}>
        추가
      </button>
    </div>
  ) : null;
};

/* 아래에서 올라와 머물다가 다시 내려간다. 전체 시간은 SUGGESTION_DURATION_MS와 같고, 올라올 때와 내려갈 때 모두 베지어 곡선이다. */
const toastKeyframes = keyframes`
  0% {
    opacity: 0;
    transform: translateY(160%);
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }
  7%,
  93% {
    opacity: 1;
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.64, 0, 0.78, 0);
  }
  100% {
    opacity: 0;
    transform: translateY(160%);
  }
`;

const styles = {
  toast: css`
    label: RecordRegisterSuggestion-toast;
    position: absolute;
    z-index: 20;
    right: 1rem;
    bottom: calc(var(--map-sheet-bottom, 0px) + 5.75rem);
    left: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    box-sizing: border-box;
    max-width: 28rem;
    margin-inline: auto;
    padding: 0.7rem 0.7rem 0.7rem 1.1rem;
    /* 공통 토스트(Toast)처럼 흰 바탕에 그림자를 두고, 글자와 버튼은 우리 파랑으로 쓴다. */
    background: rgb(255 255 255 / 96%);
    border-radius: 0.9rem;
    box-shadow: 0 3px 16px rgb(0 0 0 / 12%);
    color: var(--color-brand-blue-ink);
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.4;
    animation: ${toastKeyframes} ${SUGGESTION_DURATION_MS}ms linear both;

    & button {
      flex: none;
      padding: 0.45rem 0.9rem;
      border: 0;
      border-radius: 999px;
      background: var(--color-brand-blue);
      color: #fff;
      font: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
    }

    & button:focus-visible {
      outline: 2px solid var(--color-brand-blue-ink);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    @media (min-width: 1024px) {
      bottom: 2rem;
      font-size: 1rem;
    }
  `,
};

export default RecordRegisterSuggestion;
