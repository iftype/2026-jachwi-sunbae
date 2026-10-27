import Icon from '@/shared/ui/icon/Icon';
import IconBase from '@/shared/ui/icon/IconBase';

import { forecastHour, weatherLabel, weatherValue } from '../../lib/weatherPresentation';
import { createForecastFixture, SAMPLE_LOCATION } from '../../model/weatherFixtures';
import { useWeatherPrototype } from '../../model/WeatherPrototypeProvider';
import NotificationToggle from '../notification-toggle/NotificationToggle';
import WeatherSymbol from '../weather-symbol/WeatherSymbol';

import styles from './WeatherSummaryCard.module.css';

const WeatherSummaryCard = () => {
  const { today, scenario, locationChoice, isLocationStale, isReceiving } = useWeatherPrototype();
  const forecast = createForecastFixture(scenario, today, 0).data;
  const hour = forecast.hourly[Number(forecastHour(new Date().toISOString()))];
  const hasLocation = locationChoice === 'allowed';
  const locationName = hasLocation ? SAMPLE_LOCATION : '우리 동네';
  const showsWeather = isReceiving && scenario !== 'empty';

  return (
    <section className={styles.card} aria-labelledby="weather-summary-heading">
      <h2 id="weather-summary-heading" className="sr-only">
        생활 날씨
      </h2>
      <div className={styles.location}>
        <Icon name="locate" size={15} />
        <strong>{locationName}</strong>
        {hasLocation && isLocationStale && <span>마지막 위치 기준</span>}
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
                  {isReceiving ? (
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0" />
                  ) : (
                    <path d="M6 8a6 6 0 0 1 8.5-5.45M18 11c.4 4 3 6 3 6H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0M16 3l5 5m0-5-5 5" />
                  )}
                </IconBase>
              </span>
              <div>
                <b>{isReceiving ? '아직 예보 정보가 없어요' : '생활 날씨 알림이 꺼져 있어요'}</b>
                <p>{isReceiving ? '예보가 준비되면 보여 드릴게요' : '켜면 오늘 날씨를 여기에 보여 드려요'}</p>
              </div>
            </>
          )}
        </div>
        <p className={styles.range}>
          {showsWeather ? (
            <>
              오늘 최저 {weatherValue(forecast.tmn, '°')} <span>/</span> 최고 {weatherValue(forecast.tmx, '°')}
            </>
          ) : (
            '비·눈·추위 같은 생활 날씨를 알림으로 알려드려요.'
          )}
        </p>
      </div>
      <div className={styles.divider}>
        <NotificationToggle />
      </div>
    </section>
  );
};

export default WeatherSummaryCard;
