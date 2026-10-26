import IconBase from '@/shared/ui/icon/IconBase';

import type { WeatherHour } from '../../model/weather';

import styles from './WeatherSymbol.module.css';

type WeatherSymbolProps = { hour: Pick<WeatherHour, 'sky' | 'pty'>; size?: number };

const WeatherSymbol = ({ hour, size = 40 }: WeatherSymbolProps) => {
  const isSnow = hour.pty === 2 || hour.pty === 3;
  const isRain = hour.pty === 1 || hour.pty === 4;
  const isSunny = hour.sky === 1 && hour.pty === 0;
  return (
    <span className={isSunny ? styles.sun : styles.cloud}>
      <IconBase size={size}>
        {isSunny ? (
          <>
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
          </>
        ) : hour.sky === null && hour.pty === null ? (
          <path d="M6 12h12" />
        ) : (
          <>
            <path d="M7 16a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1A3.5 3.5 0 0 1 18 16Z" />
            {isRain && <path d="m8 19-1 2m6-2-1 2m6-2-1 2" />}
            {isSnow && <path d="M8 19v3m-1.5-1.5h3M16 19v3m-1.5-1.5h3" />}
          </>
        )}
      </IconBase>
    </span>
  );
};

export default WeatherSymbol;
