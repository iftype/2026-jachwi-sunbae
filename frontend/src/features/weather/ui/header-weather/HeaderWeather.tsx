import { css, keyframes } from '@emotion/css';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useRecentEdit } from '@/features/property/hooks/useRecentEdit';
import { openNativeSettings, supportsNativePush } from '@/shared/lib/native-app/nativePush';

import { readLastWeatherCoordinate, writeLastWeatherCoordinate } from '../../lib/lastWeatherCoordinate';
import { requestWeatherLocation } from '../../lib/weatherLocation';
import { readWeatherLocationChoice, writeWeatherLocationEnabled } from '../../lib/weatherLocationPreference';
import { weatherLabel } from '../../lib/weatherPresentation';
import { useHeaderWeather } from '../../model/useHeaderWeather';
import { useWeatherPushSync } from '../../model/useWeatherPushSync';
import { useWeatherPushToggle } from '../../model/useWeatherPushToggle';
import WeatherSymbol from '../weather-symbol/WeatherSymbol';

/** 날씨는 헤더의 기본 안내라 오래 두고, 나머지 안내는 짧게 보이고 넘긴다. */
const WEATHER_MS = 12000;
const PROMPT_MS = 5000;
type Slide = { key: string; node: (isActive: boolean) => ReactNode };

/**
 * 헤더 가운데에 띄우는 안내. 카드 없이 `[아이콘] 18°`를 크게, 위치와 상태는 옅은 글씨로 잇는다.
 * - 들어올 때 받은 위치가 있으면 현재 위치 날씨를 보인다. 헤더에서는 위치 권한을 묻지 않는다.
 * - 앱에서 알림이 꺼져 있으면 `알림 받기`(마이 토글과 같은 동작으로 그 자리에서 켬)를, 기기 알림 권한이 꺼져 있으면 같은 `알림 받기`로 기기 설정을 여는 안내를 같은 모양으로 더한다. 위치가 없으면 이 안내만 보인다.
 * - 10분 안에 고치던 매물이 있으면 `이어서 보기`를 다른 안내와 번갈아 보여 주고(새로 고친 직후에는 먼저), 누르면 그 화면으로 돌아간다. 10분이 지나면 빠진다.
 * 안내가 둘 이상이면 번갈아 보인다. 날씨는 12초, 나머지 안내는 5초 보이고, 마우스를 올리면 멈춘다.
 */
const HeaderWeather = ({ className }: { className?: string }) => {
  const { placeName, hour, precipitation, needsLocation, permission } = useHeaderWeather();
  const [locationStatus, setLocationStatus] = useState<'idle' | 'busy' | 'denied'>('idle');
  const askLocation = () => {
    if (locationStatus === 'busy') return;
    if (permission === 'denied' && supportsNativePush()) {
      void openNativeSettings().catch(() => undefined);
      return;
    }
    setLocationStatus('busy');
    // 클릭 처리기 안에서 바로 불러야 브라우저의 위치 허용 창이 뜬다. 받은 위치는 현재 위치 저장소에 올라가 날씨가 바로 보인다.
    requestWeatherLocation()
      .then((coordinate) => {
        writeWeatherLocationEnabled(true);
        writeLastWeatherCoordinate(coordinate);
        setLocationStatus('idle');
      })
      .catch(() => setLocationStatus('denied'));
  };
  const settings = useWeatherPushSync();
  const pushToggle = useWeatherPushToggle('header');
  const resumeEdit = useRecentEdit();
  const showsResume = resumeEdit !== null;
  const resumeAt = resumeEdit?.at ?? null;
  const [slide, setSlide] = useState(0);
  // 새로 고친 기록이 생기면 그 안내부터 보여 준다(안내 목록의 첫 칸).
  useEffect(() => {
    if (resumeAt !== null) setSlide(0);
  }, [resumeAt]);
  const [isPaused, setIsPaused] = useState(false);

  const slides: Slide[] = [];
  if (showsResume) {
    slides.push({
      key: 'resume-edit',
      node: (isActive) => (
        <Link
          className={`${styles.item} ${styles.prompt}`}
          data-active={isActive}
          to={resumeEdit.path}
          tabIndex={isActive ? 0 : -1}
        >
          <span className={styles.promptMessage}>
            {resumeEdit.name} {resumeEdit.kind === 'checklist' ? '체크리스트' : '기록'}를 고치던 중이었어요
          </span>
          <span className={styles.promptAction}>이어서 보기</span>
        </Link>
      ),
    });
  }
  if (hour !== null) {
    slides.push({
      key: 'weather',
      node: (isActive) => (
        <section
          className={`${styles.item} ${styles.stack}`}
          data-active={isActive}
          aria-label={`${placeName ?? '내 위치'} 날씨`}
        >
          <span className={styles.place}>{placeName ?? '내 위치'}</span>
          <span className={styles.now}>
            <WeatherSymbol hour={hour} size={20} />
            <strong>{Math.round(hour.tmp as number)}°</strong>
            <span className={styles.condition}>{weatherLabel(hour)}</span>
            {precipitation !== null && <span className={styles.condition}>오늘 강수 {precipitation.pop}%</span>}
          </span>
        </section>
      ),
    });
  }

  if (needsLocation) {
    slides.push({
      key: 'location',
      node: (isActive) => (
        <button
          type="button"
          className={`${styles.item} ${styles.prompt}`}
          data-active={isActive}
          tabIndex={isActive ? 0 : -1}
          disabled={locationStatus === 'busy'}
          aria-busy={locationStatus === 'busy'}
          onClick={askLocation}
        >
          <span className={styles.promptMessage} role={locationStatus === 'denied' ? 'status' : undefined}>
            {locationStatus === 'denied'
              ? '위치를 못 받았어요. 브라우저 설정에서 허용해 주세요'
              : '위치를 허용하면 날씨를 볼 수 있어요'}
          </span>
          <span className={styles.promptAction}>{locationStatus === 'busy' ? '확인 중' : '위치 허용'}</span>
        </button>
      ),
    });
  }
  if (supportsNativePush() && settings.data !== undefined && !settings.data.enabled) {
    const needsDeviceSetting = settings.data.problem === 'permission';
    const memberId = settings.memberId;
    const hasFailed = !needsDeviceSetting && pushToggle.isError;
    const enable = () => {
      if (memberId === null || pushToggle.isBusy) return;
      // 헤더에서는 위치 권한을 새로 묻지 않는다. 아는 마지막 위치만 날씨 알림에 쓰고, 마이를 열면 현재 위치로 다시 저장한다.
      const coordinate = readWeatherLocationChoice() !== 'off' ? readLastWeatherCoordinate() : null;
      pushToggle.mutate({
        enabled: true,
        locating: coordinate === null ? null : Promise.resolve(coordinate),
        memberId,
      });
    };
    slides.push({
      key: 'notification',
      node: (isActive) => (
        <button
          type="button"
          className={`${styles.item} ${styles.prompt}`}
          data-active={isActive}
          tabIndex={isActive ? 0 : -1}
          disabled={!needsDeviceSetting && pushToggle.isBusy}
          aria-busy={!needsDeviceSetting && pushToggle.isBusy}
          onClick={needsDeviceSetting ? () => void openNativeSettings().catch(() => undefined) : enable}
        >
          <span className={styles.promptMessage} role={hasFailed ? 'status' : undefined}>
            {needsDeviceSetting
              ? '알림을 허용하면 유용한 소식을 미리 받아요'
              : hasFailed
                ? '알림을 켜지 못했어요. 다시 시도해 주세요.'
                : '알림을 켜면 유용한 소식을 미리 받아요'}
          </span>
          <span className={styles.promptAction}>알림 받기</span>
        </button>
      ),
    });
  }

  const activeIndex = slide % Math.max(slides.length, 1);
  const isRotating = slides.length > 1 && !isPaused;
  const activeKey = slides[activeIndex]?.key;
  useEffect(() => {
    if (!isRotating || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const duration = activeKey === 'weather' ? WEATHER_MS : PROMPT_MS;
    const timer = window.setTimeout(() => setSlide((current) => current + 1), duration);
    return () => window.clearTimeout(timer);
  }, [isRotating, slide, activeKey]);

  if (slides.length === 0) return null;

  return (
    <div
      className={`${styles.root} ${className ?? ''}`.trim()}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {slides.map((item, index) => (
        <div key={item.key} className={styles.cell}>
          {item.node(index === activeIndex)}
        </div>
      ))}
    </div>
  );
};

/* 안내가 처음 생길 때 아래에서 위로 올라온다. */
const riseKeyframes = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.9rem);
  }
`;

const styles = {
  /* 안내들을 같은 칸에 겹쳐 두고 하나만 보이게 해, 바뀔 때 헤더 폭이 흔들리지 않는다. */
  root: css`
    label: HeaderWeather-root;
    display: grid;
    min-width: 0;
    justify-items: center;
    color: #25282d;
  `,

  cell: css`
    label: HeaderWeather-cell;
    grid-area: 1 / 1;
    display: grid;
    min-width: 0;
    justify-items: center;
    /* 칸들이 같은 자리에 겹쳐 있어 뒤 칸이 앞 안내의 클릭을 가로챈다. 칸은 통과시키고 보이는 안내만 클릭을 받는다. */
    pointer-events: none;
    animation: ${riseKeyframes} 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,

  item: css`
    label: HeaderWeather-item;
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.9rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-decoration: none;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transform: translateY(0.6rem);
    transition:
      opacity 0.35s ease,
      transform 0.35s ease;

    &[data-active='true'] {
      opacity: 1;
      pointer-events: auto;
      transform: none;
    }

    /* 알림을 켜는 동안 다시 누르지 못하게 잠그고 옅게 보인다. */
    &:disabled {
      cursor: default;
    }

    &[data-active='true']:disabled {
      opacity: 0.6;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,

  now: css`
    label: HeaderWeather-now;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.3rem;
    font-size: 1rem;
    line-height: 1;

    & strong {
      font-weight: 700;
      letter-spacing: -0.02em;
    }
  `,

  /* 날씨: 윗줄에 장소, 아랫줄에 아이콘과 기온, 상태를 둔다. */
  stack: css`
    label: HeaderWeather-stack;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;
  `,

  place: css`
    label: HeaderWeather-place;
    max-width: 100%;
    overflow: hidden;
    color: #6b7079;
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  condition: css`
    label: HeaderWeather-condition;
    color: #6b7079;
    font-size: 0.85rem;
    font-weight: 500;
  `,

  /* 권한 안내: 무엇을 쓸 수 있는지 한 줄, 그 아래에 허용 버튼을 둔다. 헤더 높이(2.5rem) 안에 들어간다. */
  prompt: css`
    label: HeaderWeather-prompt;
    flex-direction: column;
    justify-content: center;
    gap: 0.2rem;
  `,

  promptMessage: css`
    label: HeaderWeather-promptMessage;
    max-width: 100%;
    overflow: hidden;
    color: #6b7079;
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  promptAction: css`
    label: HeaderWeather-promptAction;
    padding: 0.2rem 0.7rem;
    border-radius: 999px;
    background: #eef3fd;
    color: var(--color-brand-blue);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.1;
  `,
};

export default HeaderWeather;
