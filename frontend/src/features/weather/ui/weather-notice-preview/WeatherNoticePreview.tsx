import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { Button } from '@/shared/ui/button/Button';
import IconBase from '@/shared/ui/icon/IconBase';

import type { NotificationSlot, WeatherCondition } from '../../model/weather';
import { weatherNoticeExamples } from '../../model/weatherNoticeExamples';

import styles from './WeatherNoticePreview.module.css';

const noticeIcons: Record<WeatherCondition, ReactNode> = {
  RAIN: <path d="M3 12a9 9 0 0 1 18 0H3Zm9-10v1m0 9v7a2 2 0 0 0 4 0" />,
  SNOW: (
    <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4m10 14-1-4 4-1M4 14l4 1-1 4m10-14-1 4 4 1" />
  ),
  FREEZE: (
    <>
      <path d="M8 3v10a4 4 0 1 0 4 0V3a2 2 0 0 0-4 0Zm2 7v7m7-13v8m-3-6 6 4m-6 0 6-4" />
      <circle cx="10" cy="17" r="1" fill="currentColor" />
    </>
  ),
  TEMPERATURE_SWING: (
    <>
      <path d="M6 4v10a4 4 0 1 0 4 0V4a2 2 0 0 0-4 0Zm2 7v7m8-14v7m-2-5 2-2 2 2m0 8v7m-2-2 2 2 2-2" />
      <circle cx="8" cy="18" r="1" fill="currentColor" />
    </>
  ),
  LAUNDRY: <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z" />,
};

const WeatherNoticePreview = () => {
  const headingId = useId();
  const [slot, setSlot] = useState<NotificationSlot>('MORNING');
  const day = slot === 'MORNING' ? '오늘' : '내일';

  return (
    <section className={styles.preview} aria-labelledby={headingId}>
      <h3 id={headingId}>생활 날씨 알림 미리보기</h3>
      <p className={styles.caption}>알림 문구 예시 · 실제 날씨와 무관</p>
      <div className={styles.slots} role="group" aria-label="알림 미리보기 시간">
        <Button
          variant={slot === 'MORNING' ? 'soft' : 'neutral'}
          aria-pressed={slot === 'MORNING'}
          onClick={() => setSlot('MORNING')}
        >
          오전 7시 · 오늘 날씨
        </Button>
        <Button
          variant={slot === 'EVENING' ? 'soft' : 'neutral'}
          aria-pressed={slot === 'EVENING'}
          onClick={() => setSlot('EVENING')}
        >
          오후 10시 · 내일 날씨
        </Button>
      </div>
      <ul className={styles.examples} aria-label="생활 날씨 알림 문구 예시" aria-live="polite" aria-atomic="true">
        {weatherNoticeExamples.map(({ condition, label, message }) => (
          <li key={condition}>
            <span className={styles.icon}>
              <IconBase size={23}>{noticeIcons[condition]}</IconBase>
            </span>
            <div>
              <strong>{label}</strong>
              <p>{`${day}${condition === 'LAUNDRY' ? '은' : ''} ${message}`}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default WeatherNoticePreview;
