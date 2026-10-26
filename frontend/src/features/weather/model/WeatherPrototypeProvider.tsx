import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import { seoulDate } from '../lib/weatherPresentation';
import type {
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
  const [settings, setSettings] = useState<WeatherNotificationSettingsResponse>({ enabled: false });
  const [notifications, setNotifications] = useState<Record<string, WeatherNotificationResponse>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  const chooseLocation = (choice: LocationChoice) => {
    setLocationChoice(choice);
    setPreviewId(null);
  };
  const selectScenario = (selection: WeatherScenario | 'denied') => {
    setPreviewId(null);
    if (selection === 'denied') setLocationChoice('denied');
    else {
      setScenario(selection);
      // 시연 컨트롤로 날씨를 고르면 샘플 위치도 함께 선택한다.
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
  const resetDemo = () => {
    setScenario('sunny');
    setLocationChoice('unknown');
    setSettings({ enabled: false });
    setPreviewId(null);
    setNotifications({});
  };
  return {
    today,
    scenario,
    locationChoice,
    settings,
    notifications,
    previewId,
    chooseLocation,
    selectScenario,
    showNotification,
    resetDemo,
    toggleNotifications: () => setSettings((current) => ({ enabled: !current.enabled })),
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
