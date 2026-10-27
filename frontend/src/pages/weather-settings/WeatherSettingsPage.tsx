import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import type { NotificationSlot, WeatherCondition } from '@/features/weather/model/weather';
import { conditionLabels, SAMPLE_LOCATION } from '@/features/weather/model/weatherFixtures';
import { useWeatherPrototype } from '@/features/weather/model/WeatherPrototypeProvider';
import NotificationToggle from '@/features/weather/ui/notification-toggle/NotificationToggle';
import ScenarioControl from '@/features/weather/ui/scenario-control/ScenarioControl';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import styles from './WeatherSettingsPage.module.css';

const WeatherSettingsPage = () => {
  const { locationChoice, isLocationStale, scenario, previewId, notifications, showNotification } =
    useWeatherPrototype();
  const [slot, setSlot] = useState<NotificationSlot>('MORNING');
  const location = useLocation();
  const from: unknown = location.state?.from;
  const backTo = from === '/weather' ? '/weather' : '/me';
  const preview = previewId === null ? null : notifications[previewId];
  const canPreview = locationChoice === 'allowed' && scenario !== 'empty';
  return (
    <main className={styles.page}>
      <TopNavigation title="생활 날씨 알림" backTo={backTo} />
      <p className={styles.intro}>
        오늘과 내일의 날씨를
        <br />
        생활에 맞춰 안내해 드려요.
      </p>
      <section className={styles.card} aria-label="알림 수신 설정">
        <NotificationToggle />
      </section>
      <section className={styles.section} aria-labelledby="schedule-title">
        <h2 id="schedule-title">하루 두 번, 필요한 시간에</h2>
        <div className={styles.schedule}>
          <div>
            <span>아침</span>
            <strong>오전 7시</strong>
            <p>오늘 07–23시 날씨</p>
          </div>
          <div>
            <span>저녁</span>
            <strong>오후 10시</strong>
            <p>내일 00–23시 날씨</p>
          </div>
        </div>
        <p className={styles.caption}>발송 시각은 고정이며, 하나의 수신 동의가 두 시간대에 함께 적용돼요.</p>
      </section>
      <section className={styles.card} aria-labelledby="notification-location-title">
        <h2 id="notification-location-title">마지막으로 선택한 위치</h2>
        <p className={styles.location}>
          <Icon name="locate" size={18} />
          {locationChoice === 'allowed'
            ? `${SAMPLE_LOCATION}${isLocationStale ? ' · 현재 위치를 찾지 못해 마지막 위치를 사용해요' : ''}`
            : '저장된 위치 없음'}
        </p>
        <p className={styles.caption}>
          실제 알림은 마지막으로 저장한 위치를 사용해요. 수신 동의·저장된 위치·등록된 기기와 발송 가능한 예보가
          필요해요.
        </p>
        {locationChoice !== 'allowed' && (
          <Link className={styles.textLink} to="/weather">
            위치 선택하기
          </Link>
        )}
      </section>
      <section className={styles.section} aria-labelledby="notice-types-title">
        <h2 id="notice-types-title">이런 날씨를 안내해요</h2>
        <ul className={styles.conditions}>
          {(Object.keys(conditionLabels) as WeatherCondition[]).map((condition) => (
            <li key={condition}>{conditionLabels[condition]}</li>
          ))}
        </ul>
        <p className={styles.caption}>
          조건에 해당하는 안내만 전해요. 별도의 주의나 추천이 없으면 예보기온 범위를 안내해요.
        </p>
      </section>
      <section className={styles.demo} aria-labelledby="push-demo-title">
        <div className={styles.demoHeading}>
          <h2 id="push-demo-title">알림 미리보기</h2>
        </div>
        <p className={styles.caption}>알림을 켜지 않아도 받게 될 알림을 미리 볼 수 있어요.</p>
        <label htmlFor="notification-slot">발송 시간</label>
        <select
          id="notification-slot"
          value={slot}
          onChange={(event) => setSlot(event.target.value as NotificationSlot)}
        >
          <option value="MORNING">오전 7시 · 오늘</option>
          <option value="EVENING">오후 10시 · 내일</option>
        </select>
        <Button variant="soft" fullWidth disabled={!canPreview} onClick={() => showNotification(slot)}>
          알림 미리보기
        </Button>
        {!canPreview && (
          <p className={styles.caption}>
            {locationChoice !== 'allowed'
              ? '위치를 선택하면 알림을 미리 볼 수 있어요.'
              : '필수 예보가 없으면 알림을 보내지 않아요.'}
          </p>
        )}
        <div aria-live="polite">
          {preview && (
            <Link to={`/weather/notifications/${preview.notificationId}`} className={styles.push}>
              <div className={styles.pushMeta}>
                <span className={styles.appIcon}>자</span>
                <b>자취선배</b>
                <span>생활 날씨 · {preview.slot === 'MORNING' ? '07:00' : '22:00'}</span>
              </div>
              <strong>{preview.title}</strong>
              <p>{preview.body}</p>
              <span className={styles.openHint}>
                눌러서 알림 당시 내용 보기 <Icon name="chevron-right" size={14} />
              </span>
            </Link>
          )}
        </div>
      </section>
      <ScenarioControl />
    </main>
  );
};

export default WeatherSettingsPage;
