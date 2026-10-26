import { useParams } from 'react-router-dom';

import { displayDate } from '@/features/weather/lib/weatherPresentation';
import { conditionLabels, SAMPLE_LOCATION } from '@/features/weather/model/weatherFixtures';
import { useWeatherPrototype } from '@/features/weather/model/WeatherPrototypeProvider';
import { ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import styles from './WeatherNotificationPage.module.css';

const WeatherNotificationPage = () => {
  const { notificationId } = useParams();
  const { notifications } = useWeatherPrototype();
  const notification =
    notificationId !== undefined && Object.prototype.hasOwnProperty.call(notifications, notificationId)
      ? notifications[notificationId]
      : undefined;
  return (
    <main className={styles.page}>
      <TopNavigation title="생활 날씨 알림 상세" backTo="/weather/settings" backLabel="알림 설정으로 돌아가기" />
      {notification === undefined ? (
        <EmptyState
          title="이 가상 알림을 찾을 수 없어요"
          description="새로고침하거나 시연을 초기화하면 임시 알림이 사라져요. 설정 화면에서 새 가상 알림을 만들어 주세요."
          action={
            <ButtonLink to="/weather/settings" variant="soft">
              가상 알림 만들러 가기
            </ButtonLink>
          }
        />
      ) : (
        <>
          <p className={styles.badge}>프로토타입 · 가상 알림</p>
          <h2 className={styles.title}>{notification.title}</h2>
          <p className={styles.body}>{notification.body}</p>
          <dl className={styles.metadata}>
            <div>
              <dt>발송일</dt>
              <dd>{displayDate(notification.sendDate)}</dd>
            </div>
            <div>
              <dt>발송 시간</dt>
              <dd>{notification.slot === 'MORNING' ? '오전 7시 · 아침' : '오후 10시 · 저녁'}</dd>
            </div>
            <div>
              <dt>예보 대상일</dt>
              <dd>{displayDate(notification.targetDate)}</dd>
            </div>
            <div>
              <dt>대상 위치</dt>
              <dd>{SAMPLE_LOCATION} (샘플 위치)</dd>
            </div>
          </dl>
          <section className={styles.notices} aria-labelledby="notices-title">
            <h2 id="notices-title">이 알림에 담긴 생활 안내</h2>
            {notification.notices.length === 0 ? (
              <p className={styles.note}>
                이 알림에는 별도 생활 안내가 없어 예보기온 범위를 담았어요. 안내가 없다고 모든 날씨 위험이 없다는 뜻은
                아니에요.
              </p>
            ) : (
              <ul>
                {notification.notices.map((notice) => (
                  <li key={notice.condition}>
                    <span>{conditionLabels[notice.condition]}</span>
                    <p>{notice.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className={styles.note}>
            가상 알림을 만든 당시 저장한 내용이에요. 이후 시나리오를 바꿔도 이 내용은 유지돼요. 모든 날짜와 시각은 한국
            시간 기준이에요.
          </p>
          <ButtonLink to="/weather" variant="soft" fullWidth>
            지금 선택한 시나리오의 날씨 보기
          </ButtonLink>
        </>
      )}
    </main>
  );
};

export default WeatherNotificationPage;
