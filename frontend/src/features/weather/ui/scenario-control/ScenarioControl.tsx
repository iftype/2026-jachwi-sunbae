import { useId } from 'react';

import { Button } from '@/shared/ui/button/Button';

import type { ClientPlatform, DevicePermission, WeatherScenario } from '../../model/weather';
import { scenarioLabels } from '../../model/weatherFixtures';
import { useWeatherPrototype } from '../../model/WeatherPrototypeProvider';

import styles from './ScenarioControl.module.css';

const ScenarioControl = () => {
  const id = useId();
  const {
    scenario,
    locationChoice,
    isLocationStale,
    platform,
    notificationPermission,
    selectScenario,
    setIsLocationStale,
    setPlatform,
    setNotificationPermission,
    resetDemo,
  } = useWeatherPrototype();
  return (
    <details className={styles.control}>
      <summary>상황 바꿔 보기</summary>
      <div className={styles.content}>
        <label htmlFor={`${id}-scenario`}>날씨 상황 선택</label>
        <select
          id={`${id}-scenario`}
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
        <label htmlFor={`${id}-platform`}>접속 환경</label>
        <select
          id={`${id}-platform`}
          value={platform}
          onChange={(event) => setPlatform(event.target.value as ClientPlatform)}
        >
          <option value="app">앱</option>
          <option value="web">웹 브라우저</option>
        </select>
        <label htmlFor={`${id}-permission`}>기기 알림 권한</label>
        <select
          id={`${id}-permission`}
          value={notificationPermission}
          onChange={(event) => setNotificationPermission(event.target.value as DevicePermission)}
        >
          <option value="unknown">아직 묻지 않음</option>
          <option value="granted">허용</option>
          <option value="denied">거부</option>
        </select>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={isLocationStale}
            onChange={(event) => setIsLocationStale(event.target.checked)}
          />
          현재 위치를 찾지 못함 (마지막 위치 사용)
        </label>
        <p>날씨를 고르면 서울 시청 위치로 전환해요. 카드·상세·알림 미리보기에 함께 반영돼요.</p>
        <Button variant="text" onClick={resetDemo}>
          처음 상태로 되돌리기
        </Button>
      </div>
    </details>
  );
};

export default ScenarioControl;
