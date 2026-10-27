import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import { seoulDate } from '../lib/weatherPresentation';
import type {
  ClientPlatform,
  DevicePermission,
  LocationChoice,
  NotificationSlot,
  WeatherNotificationResponse,
  WeatherNotificationSettingsResponse,
  WeatherScenario,
} from './weather';
import { createNotificationFixture } from './weatherFixtures';

const usePrototypeState = () => {
  const [today] = useState(() => seoulDate(new Date()));
  const [scenario, setScenario] = useState<WeatherScenario>('sunny');
  const [locationChoice, setLocationChoice] = useState<LocationChoice>('unknown');
  const [isLocationStale, setIsLocationStale] = useState(false);
  const [platform, setPlatform] = useState<ClientPlatform>('app');
  const [notificationPermission, setNotificationPermission] = useState<DevicePermission>('unknown');
  const [settings, setSettings] = useState<WeatherNotificationSettingsResponse>({ enabled: false });
  const [notifications, setNotifications] = useState<Record<string, WeatherNotificationResponse>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  const hasLocation = locationChoice === 'allowed';
  // 서버는 수신 동의·저장된 위치·등록된 기기가 모두 있어야 보낸다. 기기 권한이 꺼지면 동의가 켜져 있어도 받지 못한다.
  const isReceiving = settings.enabled && hasLocation && platform === 'app' && notificationPermission === 'granted';

  const chooseLocation = (choice: LocationChoice) => {
    setLocationChoice(choice);
    setPreviewId(null);
  };
  const selectScenario = (selection: WeatherScenario | 'denied') => {
    setPreviewId(null);
    if (selection === 'denied') setLocationChoice('denied');
    else {
      setScenario(selection);
      // 날씨 상황을 고르면 위치도 함께 선택한다.
      setLocationChoice('allowed');
    }
  };
  const showNotification = (slot: NotificationSlot) => {
    if (locationChoice !== 'allowed') return;
    const notification = createNotificationFixture(scenario, today, slot, crypto.randomUUID());
    if (notification === null) return;
    setNotifications((current) => ({ ...current, [notification.notificationId]: notification }));
    setPreviewId(notification.notificationId);
  };

  // 알림 켜기: OS가 알림 권한 → 위치 권한을 직접 묻는다. 웹은 그 결과만 받아 하나라도 거부되면 꺼진 상태로 남긴다.
  // 시연에서는 아직 묻지 않은 권한을 허용한 것으로 처리하고, 거부는 상황 바꿔 보기에서 미리 고른다.
  const toggleNotifications = () => {
    if (settings.enabled) {
      setSettings({ enabled: false });
      return;
    }
    if (platform !== 'app' || notificationPermission === 'denied' || locationChoice === 'denied') return;
    setNotificationPermission('granted');
    if (locationChoice === 'unknown') chooseLocation('allowed');
    // 처음 켤 때의 확인 알림은 앱이 OS 로컬 알림으로 보내므로 웹 화면에는 띄우지 않는다.
    setSettings({ enabled: true });
  };
  // 시연에서는 기기 설정에서 허용하고 돌아온 것으로 처리한다. 실제 앱은 브리지로 OS 설정 화면을 연다.
  const openDeviceSettings = (target: 'notification' | 'location') => {
    if (target === 'notification') setNotificationPermission('granted');
    else chooseLocation('allowed');
  };

  const resetDemo = () => {
    setScenario('sunny');
    setLocationChoice('unknown');
    setIsLocationStale(false);
    setPlatform('app');
    setNotificationPermission('unknown');
    setSettings({ enabled: false });
    setPreviewId(null);
    setNotifications({});
  };
  return {
    today,
    scenario,
    locationChoice,
    isLocationStale,
    platform,
    notificationPermission,
    settings,
    isReceiving,
    notifications,
    previewId,
    chooseLocation,
    selectScenario,
    showNotification,
    toggleNotifications,
    openDeviceSettings,
    setIsLocationStale,
    setPlatform,
    setNotificationPermission,
    resetDemo,
  };
};

const WeatherPrototypeContext = createContext<ReturnType<typeof usePrototypeState> | null>(null);

const WeatherPrototypeProvider = ({ children }: { children: ReactNode }) => (
  <WeatherPrototypeContext value={usePrototypeState()}>{children}</WeatherPrototypeContext>
);

export const useWeatherPrototype = () => {
  const context = useContext(WeatherPrototypeContext);
  if (context === null) throw new Error('WeatherPrototypeProvider가 필요합니다.');
  return context;
};

export default WeatherPrototypeProvider;
