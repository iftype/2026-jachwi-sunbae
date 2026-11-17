import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { reverseGeocode } from '@/features/map/api/mapApi';
import { useCurrentLocation } from '@/features/map/lib/currentLocationStore';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { isRunningInNativeApp } from '@/shared/lib/native-app/nativeApp';

import { fetchWeatherForecast } from '../api/weatherApi';
import { readLastWeatherCoordinate } from '../lib/lastWeatherCoordinate';
import { readWeatherLocationChoice } from '../lib/weatherLocationPreference';
import { toPlaceName } from '../lib/weatherPlaceName';
import { forecastHour, todayPrecipitation } from '../lib/weatherPresentation';
import { weatherQueryKeys } from './weatherQueryKeys';

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

/** 위치 권한을 읽고 바뀔 때마다 알린다. 권한 API가 없는 브라우저는 알 수 없음(`unknown`)이다. */
const useLocationPermission = (): PermissionState => {
  const [state, setState] = useState<PermissionState>('unknown');
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let isActive = true;
    const update = () => {
      if (isActive && status !== null) setState(status.state);
    };
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((result) => {
        status = result;
        update();
        result.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
      status?.removeEventListener('change', update);
    };
  }, []);
  return state;
};

/**
 * 헤더에 띄우는 현재 위치와 날씨. 알림 설정과 상관없이 읽기만 하고, 위치 권한은 묻지 않는다.
 * 위치는 앱(웹)에 들어올 때 `useEntryLocation`이 받아 둔다. 이번에 받은 현재 위치가 있거나,
 * 권한이 허용돼 있고 전에 받은 위치가 있으면 날씨를 읽는다. 마이에서 위치를 끄면 읽지 않는다.
 */
export const useHeaderWeather = () => {
  const config = usePublicConfig();
  const permission = useLocationPermission();
  const current = useCurrentLocation();
  const last = useMemo(() => readLastWeatherCoordinate(), []);
  // 앱 WebView는 기기에서 위치를 허용해도 권한 API가 `prompt`로 답하곤 한다. 앱에서는 `prompt`를 모름으로 본다.
  const isUncertain = permission === 'unknown' || (permission === 'prompt' && isRunningInNativeApp());
  const isLocationOn = readWeatherLocationChoice() !== 'off';
  const coordinate = current ?? (permission === 'granted' || isUncertain ? last : null);
  const isAllowed = isLocationOn && coordinate !== null;

  const forecast = useQuery({
    queryKey: coordinate === null ? ['weather', 'forecast'] : weatherQueryKeys.forecast(coordinate),
    queryFn: ({ signal }) => fetchWeatherForecast(config, coordinate as MapCoordinate, signal),
    enabled: isAllowed && coordinate !== null,
    staleTime: 10 * 60 * 1000,
  });

  const place = useQuery({
    queryKey: coordinate === null ? ['weather', 'place'] : weatherQueryKeys.place(coordinate),
    queryFn: async () => {
      const { latitude, longitude } = coordinate as MapCoordinate;
      const address = await reverseGeocode(config, latitude, longitude);
      return toPlaceName(address.jibunAddress ?? address.address);
    },
    enabled: isAllowed && coordinate !== null,
    staleTime: Infinity,
  });

  const hour = forecast.data?.hourly[Number(forecastHour(new Date().toISOString()))];

  return {
    isAllowed,
    /** 위치를 얻지 못해 날씨를 못 보이는 상태. 기본 지역 날씨로 대신하지 않고 위치 허용을 안내한다. */
    needsLocation: !isAllowed,
    permission,
    placeName: place.data ?? null,
    hour: isAllowed && hour !== undefined && hour.tmp !== null ? hour : null,
    precipitation: forecast.data === undefined ? null : todayPrecipitation(forecast.data.hourly),
  };
};
