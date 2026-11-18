import { css } from '@emotion/css';
import { useState } from 'react';

import { MENU_NEIGHBORHOOD_ICON } from '@/shared/assets/propertyImageAssets';
import { useMapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';

import { hasSeenRecordsMapIntro, hideRecordsMapIntroToday, markRecordsMapIntroSeen } from '../../model/recordsMapIntro';

/**
 * 처음 내 기록에 들어왔을 때 목록 맨 아래에 두는 동네 찾기 배너. 지도 위에 띄우지 않고 목록 흐름 안에 놓으며,
 * 버튼을 누르면 동네 찾기로 넘어간다. 아래 줄의 `오늘 하루 보지 않기`는 내일 다시 보이고, `닫기`는 다시 띄우지 않는다.
 */
const RecordNeighborhoodBanner = () => {
  const [isOpen, setIsOpen] = useState(() => !hasSeenRecordsMapIntro());
  const mode = useMapModeSwitch();
  if (!isOpen || mode === null) return null;
  return (
    <aside className={styles.card} aria-label="동네 찾기 안내">
      <div className={styles.body}>
        <p className={styles.headline}>
          어디 살지 고민이라면?
          <br />
          <em>출퇴근 시간으로</em>
          <br />
          동네를 찾아드려요!
        </p>
        <img className={styles.picture} src={MENU_NEIGHBORHOOD_ICON} alt="" width={96} height={96} />
        <button
          type="button"
          className={styles.cta}
          onClick={() => {
            markRecordsMapIntroSeen();
            setIsOpen(false);
            mode.onSwitch();
          }}
        >
          10초만에 동네 찾기
        </button>
      </div>
      <div className={styles.footer}>
        <button
          type="button"
          onClick={() => {
            hideRecordsMapIntroToday();
            setIsOpen(false);
          }}
        >
          오늘 하루 보지 않기
        </button>
        <button
          type="button"
          onClick={() => {
            markRecordsMapIntroSeen();
            setIsOpen(false);
          }}
        >
          닫기
        </button>
      </div>
    </aside>
  );
};

const styles = {
  card: css`
    label: RecordNeighborhoodBanner-card;
    flex: none;
    margin: 0.5rem 1rem 1rem;
    overflow: hidden;
    border-radius: 1.1rem;
    background: linear-gradient(135deg, #fff 55%, #eaf0ff);
    box-shadow: 0 8px 28px rgb(0 0 0 / 22%);
  `,
  body: css`
    label: RecordNeighborhoodBanner-body;
    position: relative;
    padding: 1.25rem 1.25rem 1rem;
    color: var(--color-ink);
  `,
  headline: css`
    label: RecordNeighborhoodBanner-headline;
    margin: 0 0 1rem;
    font-size: 1.15rem;
    font-weight: 800;
    line-height: 1.45;
    letter-spacing: -0.03em;

    & em {
      font-style: normal;
      color: var(--color-brand-blue-ink);
    }
  `,
  picture: css`
    label: RecordNeighborhoodBanner-picture;
    position: absolute;
    top: 0.9rem;
    right: 0.9rem;
    object-fit: contain;
    pointer-events: none;
  `,
  cta: css`
    label: RecordNeighborhoodBanner-cta;
    width: 100%;
    min-height: 3rem;
    border: 0;
    border-radius: 999px;
    background: var(--color-brand-blue-ink);
    color: #fff;
    font: inherit;
    font-size: 1rem;
    font-weight: 800;
    cursor: pointer;
  `,
  footer: css`
    label: RecordNeighborhoodBanner-footer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1.25rem;
    background: #4a4a4d;

    & button {
      padding: 0.3rem 0;
      border: 0;
      background: transparent;
      color: #fff;
      font: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
  `,
};

export default RecordNeighborhoodBanner;
