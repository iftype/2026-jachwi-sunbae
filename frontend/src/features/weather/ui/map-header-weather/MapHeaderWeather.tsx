import { lazy, Suspense } from 'react';

const HeaderWeather = lazy(() => import('../header-weather/HeaderWeather'));

const MapHeaderWeather = () => (
  <div aria-label="생활 날씨 안내" style={{ minWidth: 0, width: '100%' }}>
    <Suspense fallback={null}>
      <HeaderWeather />
    </Suspense>
  </div>
);
export default MapHeaderWeather;
