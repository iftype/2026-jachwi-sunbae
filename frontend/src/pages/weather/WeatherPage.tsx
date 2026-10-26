import { useState } from 'react';

import {
  displayDate,
  forecastHour,
  precipitationLabel,
  skyLabel,
  weatherLabel,
  weatherValue,
} from '@/features/weather/lib/weatherPresentation';
import { createForecastFixture, SAMPLE_LOCATION } from '@/features/weather/model/weatherFixtures';
import { useWeatherPrototype } from '@/features/weather/model/WeatherPrototypeProvider';
import LocationPrompt from '@/features/weather/ui/location-prompt/LocationPrompt';
import ScenarioControl from '@/features/weather/ui/scenario-control/ScenarioControl';
import WeatherSymbol from '@/features/weather/ui/weather-symbol/WeatherSymbol';
import { ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import styles from './WeatherPage.module.css';

const WeatherPage = () => {
  const { today, scenario, locationChoice } = useWeatherPrototype();
  const [day, setDay] = useState<0 | 1>(0);
  const forecast = createForecastFixture(scenario, today, day).data;
  const hour = forecast.hourly[day === 0 ? Number(forecastHour(new Date().toISOString())) : 12];
  return (
    <main className={styles.page}>
      <TopNavigation title="생활 날씨" backTo="/me" backLabel="마이페이지로 돌아가기" />
      <p className={styles.prototype}>프로토타입 · 실제 날씨가 아닌 샘플 데이터예요</p>
      {locationChoice !== 'allowed' ? (
        <LocationPrompt />
      ) : (
        <>
          <div className={styles.location}>
            <strong>{SAMPLE_LOCATION}</strong>
            <span>샘플 위치</span>
          </div>
          <div className={styles.tabs} role="group" aria-label="예보 날짜">
            {([0, 1] as const).map((value) => (
              <button type="button" key={value} aria-pressed={day === value} onClick={() => setDay(value)}>
                {value === 0 ? '오늘' : '내일'}
              </button>
            ))}
          </div>
          <p className={styles.date}>{displayDate(forecast.date)} · 한국 시간</p>
          {scenario === 'empty' ? (
            <EmptyState
              title="아직 예보 정보가 없어요"
              description="이 날짜의 예보를 준비하고 있어요. 값이 없는 항목은 정보 없음으로 표시해요."
            />
          ) : (
            <section className={styles.hero} aria-label="날씨 요약">
              <WeatherSymbol hour={hour} size={72} />
              <p>{weatherLabel(hour)}</p>
              <strong>{weatherValue(hour.tmp, '°')}</strong>
              <p>{day === 0 ? `${forecastHour(hour.forecastAt)}시 예보` : '12시 대표 예보'}</p>
              <div>
                최저 {weatherValue(forecast.tmn, '°')} <span>/</span> 최고 {weatherValue(forecast.tmx, '°')}
              </div>
              <small>실시간 관측값이 아닌 시간별 예보기온이에요.</small>
            </section>
          )}
          <section className={styles.section} aria-labelledby="hourly-heading">
            <div className={styles.sectionHeading}>
              <h2 id="hourly-heading">시간별 날씨</h2>
              <span>00–23시</span>
            </div>
            <p className={styles.hint}>옆으로 넘겨 기온과 강수 정보를 확인해요.</p>
            <ul className={styles.hourly} aria-label="시간별 예보" tabIndex={0}>
              {forecast.hourly.map((item) => (
                <li
                  key={item.forecastAt}
                  aria-label={`${forecastHour(item.forecastAt)}시 예보`}
                  data-selected={item.forecastAt === hour.forecastAt}
                >
                  <time dateTime={item.forecastAt}>{forecastHour(item.forecastAt)}시</time>
                  <WeatherSymbol hour={item} size={28} />
                  <span className={styles.sky}>{weatherLabel(item)}</span>
                  <strong>{weatherValue(item.tmp, '°')}</strong>
                  <span>강수 {weatherValue(item.pop, '%')}</span>
                  <span>{precipitationLabel(item.pty)}</span>
                  <span>{weatherValue(item.pcp, ' mm')}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.section} aria-labelledby="detail-heading">
            <h2 id="detail-heading">{forecastHour(hour.forecastAt)}시 자세한 예보</h2>
            <dl className={styles.metrics}>
              {[
                ['강수확률', weatherValue(hour.pop, '%')],
                ['습도', weatherValue(hour.reh, '%')],
                ['풍속', weatherValue(hour.wsd, ' m/s')],
                ['1시간 강수량', weatherValue(hour.pcp, ' mm')],
                ['1시간 신적설', weatherValue(hour.sno, ' cm')],
                ['하늘 상태', skyLabel(hour.sky)],
                ['강수형태', precipitationLabel(hour.pty)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.hint}>
              예보 발표:{' '}
              {hour.publishedAt === null
                ? '정보 없음'
                : `${displayDate(hour.publishedAt.slice(0, 10))} ${forecastHour(hour.publishedAt)}시 (샘플)`}
            </p>
          </section>
        </>
      )}
      <ButtonLink to="/weather/settings" state={{ from: '/weather' }} variant="soft" fullWidth>
        생활 날씨 알림 설정
      </ButtonLink>
      <ScenarioControl />
    </main>
  );
};

export default WeatherPage;
