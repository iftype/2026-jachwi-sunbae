import { useId } from 'react';

import styles from './NotificationToggle.module.css';

type NotificationToggleProps = {
  checked: boolean;
  disabled: boolean;
  /** 받을 수 없는 이유나 실패 안내. 없으면 그리지 않는다. */
  message: string | null;
  onToggle: () => void;
};

/** 알림 받기 토글. 권한은 OS가 직접 묻고, 받을 수 없는 이유만 토글 아래에 알린다. */
const NotificationToggle = ({ checked, disabled, message, onToggle }: NotificationToggleProps) => {
  const labelId = useId();
  return (
    <>
      <div className={styles.row}>
        <p className={styles.label}>
          <strong id={labelId}>알림 받기</strong>
          <span>매일 오전 7시, 오후 10시</span>
        </p>
        <button
          className={styles.toggle}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          disabled={disabled}
          onClick={onToggle}
        >
          <span />
        </button>
      </div>
      {message && (
        <p className={styles.blocker} role="status">
          {message}
        </p>
      )}
    </>
  );
};

export default NotificationToggle;
