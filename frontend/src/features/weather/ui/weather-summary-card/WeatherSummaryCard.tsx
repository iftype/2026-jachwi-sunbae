import { css, keyframes } from '@emotion/css';

import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import IconBase from '@/shared/ui/icon/IconBase';

import { useWeatherCardViewed } from '../../lib/weatherAnalytics';
import { forecastHour, weatherLabel, weatherValue } from '../../lib/weatherPresentation';
import { useWeatherSubscription } from '../../model/useWeatherSubscription';
import { useWeatherTestPush } from '../../model/useWeatherTestPush';
import NotificationToggle from '../notification-toggle/NotificationToggle';
import WeatherSymbol from '../weather-symbol/WeatherSymbol';
import WeatherTestPushButton from '../weather-test-push-button/WeatherTestPushButton';

const BELL = 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0';
const BELL_OFF = 'M6 8a6 6 0 0 1 8.5-5.45M18 11c.4 4 3 6 3 6H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0M16 3l5 5m0-5-5 5';

const WeatherSummaryCard = () => {
  const {
    platform,
    isEnabled,
    isLoading,
    isUpdating,
    isLocating,
    hasUpdateFailed,
    location,
    isLocationOn,
    placeName,
    forecast,
    toggle,
    pushMessage,
    canRetry,
    retry,
    canOpenSettings,
    openSettings,
  } = useWeatherSubscription();
  const testPush = useWeatherTestPush(isEnabled);
  const hour = forecast.data?.hourly[Number(forecastHour(new Date().toISOString()))];
  const showsWeather = isEnabled && hour !== undefined && hour.tmp !== null;
  useWeatherCardViewed(showsWeather);
  // 알림은 켰지만 위치 확인에 실패했고 마지막 위치도 없어 날씨를 그릴 수 없다. 공통 알림이라 배달 할인 알림은 계속 받는다.
  const isLocationOff = isEnabled && !isLocationOn && location.status !== 'denied';
  const hasNoLocation =
    isEnabled && location.coordinate === null && (location.status === 'denied' || location.status === 'unavailable');

  // 알림이 꺼져 있거나 날씨를 아직 못 그릴 때 대표 줄에 보일 안내
  const state = !isEnabled
    ? { icon: BELL_OFF, title: '알림이 꺼져 있어요', detail: '켜면 오늘 날씨를 여기에 보여 드려요' }
    : isLocationOff
      ? { icon: BELL, title: '현재 위치가 꺼져 있어요', detail: '위치를 허용하면 지금 동네 날씨를 보여 드려요' }
      : hasNoLocation
        ? { icon: BELL, title: '날씨는 위치를 확인한 뒤 알려 드려요', detail: '배달 할인 알림은 위치 없이도 받아요' }
        : forecast.isError
          ? { icon: BELL, title: '날씨를 불러오지 못했어요', detail: '잠시 후 다시 확인해 주세요' }
          : forecast.data === undefined
            ? { icon: BELL, title: '날씨를 불러오고 있어요', detail: '현재 위치의 예보를 확인하고 있어요' }
            : { icon: BELL, title: '아직 예보 정보가 없어요', detail: '예보가 준비되면 보여 드릴게요' };

  // 위치 권한이 꺼져 있으면 켜는 곳을 토글 아래 한 줄로 알린다.
  const deniedMessage = `${
    location.isStale ? '위치 권한이 꺼져 있어 마지막 위치로 알려드려요.' : '위치 권한이 꺼져 있어요.'
  } ${platform === 'app' ? '아래 설정 열기에서 켜 주세요.' : '주소창 왼쪽 자물쇠에서 허용해 주세요.'}`;

  const message =
    pushMessage ??
    (hasUpdateFailed
      ? '알림 설정을 바꾸지 못했어요. 다시 시도해 주세요.'
      : location.status === 'denied'
        ? deniedMessage
        : hasNoLocation
          ? '지금 위치를 확인하지 못했어요. 다음에 열 때 다시 확인할게요.'
          : platform === 'web'
            ? '알림은 앱에서 받을 수 있어요.'
            : null);

  return (
    <section className={styles.card} aria-labelledby="weather-summary-heading">
      <h2 id="weather-summary-heading" className="sr-only">
        생활 날씨
      </h2>
      <div className={styles.location}>
        <Icon name="locate" size={15} />
        <strong>{isEnabled ? (placeName ?? '내 위치') : '우리 동네'}</strong>
        {isEnabled && location.isStale && <span>마지막 위치 기준</span>}
        <span className={styles.today}>오늘</span>
      </div>
      {/* 알림을 켜고 끌 때 카드 높이가 바뀌지 않도록 켜짐·꺼짐 모두 같은 두 줄(대표 줄·보조 줄)로 그린다. */}
      {/* 켜짐·꺼짐이 바뀔 때마다 새로 그려 전환 효과를 다시 재생한다. */}
      <div key={showsWeather ? 'weather' : 'state'} className={styles.swap}>
        <div className={styles.weather}>
          {showsWeather ? (
            <>
              <WeatherSymbol hour={hour} size={34} />
              <strong className={styles.temperature}>{weatherValue(hour.tmp, '°')}</strong>
              <div>
                <b>{weatherLabel(hour)}</b>
                <p>{forecastHour(hour.forecastAt)}시 예보</p>
              </div>
            </>
          ) : (
            <>
              <span className={styles.stateIcon}>
                <IconBase size={30}>
                  <path d={state.icon} />
                </IconBase>
              </span>
              <div>
                <b>{state.title}</b>
                <p>{state.detail}</p>
              </div>
            </>
          )}
        </div>
        <p className={styles.range}>
          {showsWeather && forecast.data ? (
            <>
              오늘 최저 {weatherValue(forecast.data.tmn, '°')} <span>/</span> 최고{' '}
              {weatherValue(forecast.data.tmx, '°')}
            </>
          ) : (
            '생활 날씨와 배달 할인 소식을 알림으로 알려드려요.'
          )}
        </p>
      </div>
      <div className={styles.divider}>
        <NotificationToggle
          checked={isEnabled}
          disabled={isLoading || isUpdating}
          isBusy={isLocating}
          busyLabel="현재 위치를 확인하고 있어요."
          message={message}
          onToggle={toggle}
        />
        {canOpenSettings && (
          <Button variant="secondary" onClick={openSettings}>
            설정 열기
          </Button>
        )}
        {testPush.canSend && (
          <WeatherTestPushButton status={testPush.status} secondsLeft={testPush.secondsLeft} onSend={testPush.send} />
        )}
        {canRetry && (
          <Button variant="secondary" onClick={retry}>
            알림 연결 다시 시도
          </Button>
        )}
      </div>
    </section>
  );
};

const swapInKeyframes = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.4rem);
  }
`;

const styles = {
  card: css`
    label: WeatherSummaryCard-card;
    padding: var(--my-card-padding, 1.15rem);
    border-radius: var(--radius-md);
    background: var(--my-card-surface, var(--color-card-surface));
    color: var(--color-ink);
  `,

  location: css`
    label: WeatherSummaryCard-location;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-ink-soft);
    font-size: var(--my-subtext-size, 0.78rem);

    & > span {
      color: var(--color-ink-soft);
      font-size: var(--my-subtext-size, 0.78rem);
    }
  `,

  /* 켜짐(기온)·꺼짐(안내) 어느 쪽이든 같은 높이를 차지한다. */
  weather: css`
    label: WeatherSummaryCard-weather;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    margin: 0.4rem 0;

    & b {
      font-size: var(--my-text-size, 0.95rem);
    }

    & p {
      margin: 0.15rem 0 0;
      color: var(--color-ink-soft);
      font-size: var(--my-subtext-size, 0.78rem);
    }
  `,

  stateIcon: css`
    label: WeatherSummaryCard-stateIcon;
    display: inline-flex;
    flex-shrink: 0;
    justify-content: center;
    width: 34px;
    color: var(--color-ink);
  `,

  temperature: css`
    label: WeatherSummaryCard-temperature;
    font-size: 1.65rem;
    font-weight: 750;
    letter-spacing: -0.08rem;
  `,

  range: css`
    label: WeatherSummaryCard-range;
    display: flex;
    margin: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--my-subtext-size, 0.78rem);

    & > span {
      color: var(--color-ink-soft);
    }
  `,

  today: css`
    label: WeatherSummaryCard-today;
    margin-left: auto;
  `,

  divider: css`
    label: WeatherSummaryCard-divider;
    margin-top: 0.55rem;
    padding-top: 0.45rem;
    border-top: 1px solid var(--color-border);
  `,

  /* 알림을 켜고 끌 때 바뀐 내용이 살짝 올라오며 나타난다. 카드 높이는 그대로라 아래 내용은 움직이지 않는다. */
  swap: css`
    label: WeatherSummaryCard-swap;
    animation: ${swapInKeyframes} 280ms ease-out;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
};

export default WeatherSummaryCard;
