import { css, keyframes } from '@emotion/css';
import { useEffect } from 'react';

/** 안내가 떠 있는 시간. 닫기 버튼이 없어 이 시간이 지나면 스스로 사라진다. */
const NOTICE_DURATION_MS = 3500;

type RecordNoticeProps = {
  message: string;
  onClose: () => void;
  className?: string;
};

/**
 * 기록 삭제, 등록, 위치 권한 같은 일을 알리려고 화면 아래에 잠깐 띄우는 안내. 글자는 가운데에 두고 닫기 버튼은 없다.
 * 같은 안내가 떠 있는 동안 다시 눌러도 하나만 보이고 시간도 늘어나지 않는다(메시지가 그대로면 다시 그리지 않는다).
 */
const RecordNotice = ({ message, onClose, className }: RecordNoticeProps) => {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
    // onClose는 렌더마다 새로 만들어지므로 메시지가 바뀔 때만 시간을 다시 잰다.
  }, [message]);

  return message ? (
    <div className={`${styles.notice} ${className ?? ''}`.trim()} role="status">
      {message}
    </div>
  ) : null;
};

/*
 * 아래에서 올라와 머물다가 다시 내려간다. 올라올 때는 빠르게 시작해 부드럽게 멈추는 베지어 곡선을,
 * 내려갈 때는 천천히 시작해 빠르게 빠지는 베지어 곡선을 쓴다. 전체 시간은 NOTICE_DURATION_MS와 같다.
 */
const noticeKeyframes = keyframes`
  0% {
    opacity: 0;
    transform: translateY(160%);
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }
  11%,
  89% {
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
  notice: css`
    label: RecordNotice-notice;
    position: absolute;
    left: 1rem;
    right: 1rem;
    bottom: calc(var(--map-sheet-bottom, 0px) + 5.75rem);
    z-index: 20;
    padding: 1rem;
    /* 공통 토스트(Toast)처럼 흰 바탕에 그림자를 두고, 글자는 우리 파랑으로 쓴다. */
    background: rgb(255 255 255 / 96%);
    color: var(--color-brand-blue-ink);
    box-shadow: 0 3px 16px rgb(0 0 0 / 12%);
    border-radius: 0.9rem;
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.5;
    text-align: center;
    animation: ${noticeKeyframes} ${NOTICE_DURATION_MS}ms linear both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    @media (min-width: 768px) {
      font-size: 1.05rem;
    }
  `,
};

export default RecordNotice;
