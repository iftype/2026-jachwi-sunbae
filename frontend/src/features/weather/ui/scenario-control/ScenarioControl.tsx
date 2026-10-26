import { useId } from 'react';

import { Button } from '@/shared/ui/button/Button';

import type { WeatherScenario } from '../../model/weather';
import { scenarioLabels } from '../../model/weatherFixtures';
import { useWeatherPrototype } from '../../model/WeatherPrototypeProvider';

import styles from './ScenarioControl.module.css';

const ScenarioControl = () => {
  const id = useId();
  const { scenario, locationChoice, selectScenario, resetDemo } = useWeatherPrototype();
  return (
    <details className={styles.control}>
      <summary>
        프로토타입 시나리오 <span>시연용</span>
      </summary>
      <div className={styles.content}>
        <label htmlFor={id}>날씨 상황 선택</label>
        <select
          id={id}
          value={locationChoice === 'denied' ? 'denied' : scenario}
          onChange={(event) => selectScenario(event.target.value as WeatherScenario | 'denied')}
        >
          {Object.entries(scenarioLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="denied">위치 사용 거부</option>
        </select>
        <p>날씨를 고르면 서울 시청 샘플 위치로 전환해요. 카드·상세·새 가상 알림에 함께 반영돼요.</p>
        <Button variant="text" onClick={resetDemo}>
          처음부터 시연하기
        </Button>
      </div>
    </details>
  );
};

export default ScenarioControl;
