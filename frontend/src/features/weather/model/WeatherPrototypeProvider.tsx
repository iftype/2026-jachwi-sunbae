import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import { seoulDate } from '../lib/weatherPresentation';
import type {
  ClientPlatform,
  DevicePermission,
  LocationChoice,
  WeatherNotificationSettingsResponse,
  WeatherScenario,
} from './weather';

/** 실제 API·앱 연동 전 화면 상태. 테스트는 권한 거부·웹 접속 같은 상황을 시작 값으로 넣는다. */
export type WeatherPrototypeInitialState = {
  scenario?: WeatherScenario;
  locationChoice?: LocationChoice;
  isLocationStale?: boolean;
  platform?: ClientPlatform;
  notificationPermission?: DevicePermission;
};

const usePrototypeState = (initial: WeatherPrototypeInitialState) => {
  const [today] = useState(() => seoulDate(new Date()));
  const [scenario] = useState<WeatherScenario>(initial.scenario ?? 'sunny');
  const [locationChoice, setLocationChoice] = useState<LocationChoice>(initial.locationChoice ?? 'unknown');
  const [isLocationStale] = useState(initial.isLocationStale ?? false);
  const [platform] = useState<ClientPlatform>(initial.platform ?? 'app');
  const [notificationPermission, setNotificationPermission] = useState<DevicePermission>(
    initial.notificationPermission ?? 'unknown',
  );
  const [settings, setSettings] = useState<WeatherNotificationSettingsResponse>({ enabled: false });

  const hasLocation = locationChoice === 'allowed';
  // 서버는 수신 동의·저장된 위치·등록된 기기가 모두 있어야 보낸다. 기기 권한이 꺼지면 동의가 켜져 있어도 받지 못한다.
  const isReceiving = settings.enabled && hasLocation && platform === 'app' && notificationPermission === 'granted';

  // 알림 켜기: OS가 알림 권한 → 위치 권한을 직접 묻는다. 웹은 그 결과만 받아 하나라도 거부되면 꺼진 상태로 남긴다.
  // 지금은 아직 묻지 않은 권한을 허용한 것으로 처리한다.
  const toggleNotifications = () => {
    if (settings.enabled) {
      setSettings({ enabled: false });
      return;
    }
    if (platform !== 'app' || notificationPermission === 'denied' || locationChoice === 'denied') return;
    setNotificationPermission('granted');
    if (locationChoice === 'unknown') setLocationChoice('allowed');
    setSettings({ enabled: true });
  };
  // 기기 설정에서 허용하고 돌아온 것으로 처리한다. 실제 앱은 브리지로 OS 설정 화면을 연다.
  const openDeviceSettings = (target: 'notification' | 'location') => {
    if (target === 'notification') setNotificationPermission('granted');
    else setLocationChoice('allowed');
  };

  return {
    today,
    scenario,
    locationChoice,
    isLocationStale,
    platform,
    notificationPermission,
    isReceiving,
    toggleNotifications,
    openDeviceSettings,
  };
};

const WeatherPrototypeContext = createContext<ReturnType<typeof usePrototypeState> | null>(null);

type WeatherPrototypeProviderProps = { children: ReactNode; initialState?: WeatherPrototypeInitialState };

const WeatherPrototypeProvider = ({ children, initialState = {} }: WeatherPrototypeProviderProps) => (
  <WeatherPrototypeContext value={usePrototypeState(initialState)}>{children}</WeatherPrototypeContext>
);

export const useWeatherPrototype = () => {
  const context = useContext(WeatherPrototypeContext);
  if (context === null) throw new Error('WeatherPrototypeProvider가 필요합니다.');
  return context;
};

export default WeatherPrototypeProvider;
