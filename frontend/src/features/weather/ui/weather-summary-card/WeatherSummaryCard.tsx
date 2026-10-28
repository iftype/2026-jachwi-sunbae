import Icon from '@/shared/ui/icon/Icon';
import IconBase from '@/shared/ui/icon/IconBase';

import { forecastHour, weatherLabel, weatherValue } from '../../lib/weatherPresentation';
import { useWeatherSubscription } from '../../model/useWeatherSubscription';
import NotificationToggle from '../notification-toggle/NotificationToggle';
import WeatherSymbol from '../weather-symbol/WeatherSymbol';

import styles from './WeatherSummaryCard.module.css';

const BELL = 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0';
const BELL_OFF = 'M6 8a6 6 0 0 1 8.5-5.45M18 11c.4 4 3 6 3 6H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0M16 3l5 5m0-5-5 5';

const WeatherSummaryCard = () => {
  const { platform, isEnabled, isLoading, isUpdating, hasUpdateFailed, location, placeName, forecast, toggle } =
    useWeatherSubscription();
  const hour = forecast.data?.hourly[Number(forecastHour(new Date().toISOString()))];
  const showsWeather = isEnabled && hour !== undefined && hour.tmp !== null;

  // 알림이 꺼져 있거나 날씨를 아직 못 그릴 때 대표 줄에 보일 안내
  const state = !isEnabled
    ? { icon: BELL_OFF, title: '생활 날씨 알림이 꺼져 있어요', detail: '켜면 오늘 날씨를 여기에 보여 드려요' }
    : forecast.isError
      ? { icon: BELL, title: '날씨를 불러오지 못했어요', detail: '잠시 후 다시 확인해 주세요' }
      : forecast.data === undefined
        ? { icon: BELL, title: '날씨를 불러오고 있어요', detail: '현재 위치의 예보를 확인하고 있어요' }
        : { icon: BELL, title: '아직 예보 정보가 없어요', detail: '예보가 준비되면 보여 드릴게요' };

  const message = hasUpdateFailed
    ? '알림 설정을 바꾸지 못했어요. 다시 시도해 주세요.'
    : location.status === 'denied'
      ? location.isStale
        ? '위치 권한이 꺼져 있어 마지막 위치로 알려드려요.'
        : '위치 권한을 허용해야 알림을 받을 수 있어요.'
      : platform === 'web'
        ? '알림은 앱에서 받을 수 있어요.'
        : null;

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
              <WeatherSymbol hour={hour} size={46} />
              <strong className={styles.temperature}>{weatherValue(hour.tmp, '°')}</strong>
              <div>
                <b>{weatherLabel(hour)}</b>
                <p>{forecastHour(hour.forecastAt)}시 예보</p>
              </div>
            </>
          ) : (
            <>
              <span className={styles.stateIcon}>
                <IconBase size={40}>
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
            '비·눈·추위 같은 생활 날씨를 알림으로 알려드려요.'
          )}
        </p>
      </div>
      <div className={styles.divider}>
        <NotificationToggle
          checked={isEnabled}
          disabled={isLoading || isUpdating}
          message={message}
          onToggle={toggle}
        />
      </div>
    </section>
  );
};

export default WeatherSummaryCard;
