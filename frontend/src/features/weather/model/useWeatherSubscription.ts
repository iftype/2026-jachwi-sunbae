import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { reverseGeocode } from '@/features/map/api/mapApi';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import { MapLocationError, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { isRunningInNativeApp } from '@/shared/lib/native-app/nativeApp';

import {
  fetchWeatherForecast,
  fetchWeatherNotificationSettings,
  syncWeatherLocation,
  updateWeatherNotificationSettings,
  weatherQueryKeys,
} from '../api/weatherApi';
import { readLastWeatherCoordinate, writeLastWeatherCoordinate } from '../lib/lastWeatherCoordinate';

export type WeatherLocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';

type WeatherLocationState = {
  status: WeatherLocationStatus;
  coordinate: MapCoordinate | null;
  /** 현재 위치를 못 잡아 마지막 위치를 쓰는 중인지 */
  isStale: boolean;
};

/** 지번 주소에서 시·도를 뺀 구·동 정도만 남긴다. 예: "서울 중구 태평로1가 31" → "중구 태평로1가" */
const toPlaceName = (address: string | null): string | null => {
  const words = (address ?? '').split(' ').filter((word) => word.length > 0 && !/^\d/.test(word));
  return words.length > 1 ? words.slice(1, 3).join(' ') : null;
};

/**
 * 마이의 생활 날씨 카드 상태. 수신 동의는 서버에, 알림 위치는 기기 GPS로 구해 서버에 저장한다.
 * 알림을 켜 둔 채 화면을 열 때마다 위치를 다시 저장한다. 서버는 마지막으로 저장한 위치로 알림을 보내기 때문이다.
 */
export const useWeatherSubscription = () => {
  const config = usePublicConfig();
  const queryClient = useQueryClient();
  const platform = isRunningInNativeApp() ? 'app' : 'web';
  const hasSyncedRef = useRef(false);
  const [location, setLocation] = useState<WeatherLocationState>(() => ({
    status: 'idle',
    coordinate: readLastWeatherCoordinate(),
    isStale: false,
  }));

  const settings = useQuery({
    queryKey: weatherQueryKeys.settings,
    queryFn: ({ signal }) => fetchWeatherNotificationSettings(config, signal),
  });
  const isEnabled = settings.data?.enabled ?? false;

  // 사파리는 누른 순간에만 위치 권한 창을 띄우므로, 위치 요청은 await 없이 바로 시작한다.
  const locate = useCallback((): Promise<MapCoordinate | null> => {
    hasSyncedRef.current = true;
    setLocation((current) => ({ ...current, status: 'locating' }));
    return requestCurrentMapLocation().then(
      async (coordinate) => {
        writeLastWeatherCoordinate(coordinate);
        setLocation({ status: 'ready', coordinate, isStale: false });
        await syncWeatherLocation(config, coordinate);
        return coordinate;
      },
      (error: unknown) => {
        const last = readLastWeatherCoordinate();
        const denied = error instanceof MapLocationError && error.reason === 'denied';
        setLocation({ status: denied ? 'denied' : 'unavailable', coordinate: last, isStale: last !== null });
        return last;
      },
    );
  }, [config]);

  useEffect(() => {
    if (isEnabled && !hasSyncedRef.current) void locate();
  }, [isEnabled, locate]);

  const toggle = useMutation({
    mutationFn: async ({ enabled, locating }: { enabled: boolean; locating: Promise<MapCoordinate | null> | null }) => {
      // 알림은 저장된 위치가 있어야 발송되므로, 위치를 하나도 모르면 켜지 않는다.
      if (locating !== null && (await locating) === null) return { enabled: false };
      return updateWeatherNotificationSettings(config, enabled);
    },
    onSuccess: (data) => queryClient.setQueryData(weatherQueryKeys.settings, data),
  });

  const forecast = useQuery({
    queryKey: location.coordinate === null ? ['weather', 'forecast'] : weatherQueryKeys.forecast(location.coordinate),
    queryFn: ({ signal }) => fetchWeatherForecast(config, location.coordinate as MapCoordinate, signal),
    enabled: isEnabled && location.coordinate !== null,
  });

  const place = useQuery({
    queryKey: location.coordinate === null ? ['weather', 'place'] : weatherQueryKeys.place(location.coordinate),
    queryFn: async () => {
      const coordinate = location.coordinate as MapCoordinate;
      const address = await reverseGeocode(config, coordinate.latitude, coordinate.longitude);
      return toPlaceName(address.jibunAddress ?? address.address);
    },
    enabled: isEnabled && location.coordinate !== null,
    staleTime: Infinity,
  });

  return {
    platform,
    isEnabled,
    isLoading: settings.isPending,
    isUpdating: toggle.isPending || location.status === 'locating',
    hasUpdateFailed: toggle.isError,
    location,
    placeName: place.data ?? null,
    forecast,
    toggle: () => toggle.mutate({ enabled: !isEnabled, locating: isEnabled ? null : locate() }),
  };
};
