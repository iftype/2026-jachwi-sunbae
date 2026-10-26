import { Link } from 'react-router-dom';

import EmptyState from '@/shared/ui/empty-state/EmptyState';
import Icon from '@/shared/ui/icon/Icon';

import { forecastHour, weatherLabel, weatherValue } from '../../lib/weatherPresentation';
import { createForecastFixture, SAMPLE_LOCATION } from '../../model/weatherFixtures';
import { useWeatherPrototype } from '../../model/WeatherPrototypeProvider';
import LocationPrompt from '../location-prompt/LocationPrompt';
import ScenarioControl from '../scenario-control/ScenarioControl';
import WeatherSymbol from '../weather-symbol/WeatherSymbol';

import styles from './WeatherSummaryCard.module.css';

const WeatherSummaryCard = () => {
  const { today, scenario, locationChoice } = useWeatherPrototype();
  const forecast = createForecastFixture(scenario, today, 0).data;
  const hour = forecast.hourly[Number(forecastHour(new Date().toISOString()))];
  return (
    <section className={styles.section} aria-label="생활 날씨">
      <div className={styles.heading}>
        <h2>생활 날씨</h2>
        <span>프로토타입 · 샘플 데이터</span>
      </div>
      {locationChoice !== 'allowed' ? (
        <LocationPrompt />
      ) : scenario === 'empty' ? (
        <EmptyState
          title="아직 예보 정보가 없어요"
          description="서울 시청 (샘플 위치)의 예보를 준비하고 있어요."
          action={<Link to="/weather">날씨 상세 보기</Link>}
        />
      ) : (
        <Link to="/weather" className={styles.card} aria-label="서울 시청 날씨 상세 보기">
          <div className={styles.location}>
            <Icon name="locate" size={15} />
            <strong>{SAMPLE_LOCATION}</strong>
            <span>샘플 위치</span>
            <Icon name="chevron-right" size={18} />
          </div>
          <div className={styles.weather}>
            <WeatherSymbol hour={hour} size={46} />
            <strong className={styles.temperature}>{weatherValue(hour.tmp, '°')}</strong>
            <div>
              <b>{weatherLabel(hour)}</b>
              <p>{forecastHour(hour.forecastAt)}시 예보 · 실시간 관측 아님</p>
            </div>
          </div>
          <div className={styles.range}>
            오늘 최저 {weatherValue(forecast.tmn, '°')} <span>/</span> 최고 {weatherValue(forecast.tmx, '°')}
            <span className={styles.detail}>오늘·내일 보기</span>
          </div>
        </Link>
      )}
      <Link className={styles.settings} to="/weather/settings" state={{ from: '/me' }}>
        <span>생활 날씨 알림 설정</span>
        <Icon name="chevron-right" size={18} />
      </Link>
      <ScenarioControl />
    </section>
  );
};

export default WeatherSummaryCard;
