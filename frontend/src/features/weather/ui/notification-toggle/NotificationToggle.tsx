import { useId } from 'react';

import { useWeatherPrototype } from '../../model/WeatherPrototypeProvider';

import styles from './NotificationToggle.module.css';

/** 알림 받기 토글. 권한은 OS가 직접 묻고, 받을 수 없는 이유만 토글 아래에 알린다. */
const NotificationToggle = () => {
  const labelId = useId();
  const { platform, notificationPermission, locationChoice, isReceiving, toggleNotifications, openDeviceSettings } =
    useWeatherPrototype();

  const blocker =
    platform === 'web'
      ? { message: '앱에서 알림을 받을 수 있어요.', target: null }
      : notificationPermission === 'denied'
        ? { message: '기기 알림이 꺼져 있어요.', target: 'notification' as const }
        : locationChoice === 'denied'
          ? { message: '위치 권한이 꺼져 있어 알림을 보낼 수 없어요.', target: 'location' as const }
          : null;

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
          aria-checked={isReceiving}
          aria-labelledby={labelId}
          disabled={platform === 'web'}
          onClick={toggleNotifications}
        >
          <span />
        </button>
      </div>
      {blocker && (
        <p className={styles.blocker} role="status">
          {blocker.message}
          {blocker.target && (
            <button type="button" onClick={() => openDeviceSettings(blocker.target)}>
              설정 열기
            </button>
          )}
        </p>
      )}
    </>
  );
};

export default NotificationToggle;
