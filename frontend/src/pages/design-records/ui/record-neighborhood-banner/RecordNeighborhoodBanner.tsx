import { css, cx } from '@emotion/css';

import { useAdminDongBookmarks } from '@/features/map/api/useAdminDongBookmarks';
import NEIGHBORHOOD_ICON from '@/shared/assets/illustrations/icon-map.webp';
import Icon from '@/shared/ui/icon/Icon';
import { useMapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';

import { hasUsedFinder, HIDE_FINDER_BANNER_AFTER_USE, markFinderUsed } from '../../model/finderUsed';

type Props = {
  /** 지도 위 자리(아래 간격, 겹침 순서)를 화면마다 정한다. */
  className?: string;
};

/**
 * 내 기록 지도 아래쪽에 띄우는 동네 찾기 가로 배너. 닫지 못하고, 누르면 동네 찾기로 넘어간다.
 * 표시 조건: 통합 지도 안이고, 동네 찾기 배너를 누르거나 결과를 본 적이 없고(`jachwi:finder-used`), 찜한 동네가 없을 때.
 * (`HIDE_FINDER_BANNER_AFTER_USE`가 false면 항상 보인다. 이 밖의 조건(매물이나 메모가 열려 있지 않음)은 지도 화면이 정한다.)
 */
const RecordNeighborhoodBanner = ({ className }: Props) => {
  const mode = useMapModeSwitch();
  const bookmarks = useAdminDongBookmarks();
  if (mode === null) return null;
  if (HIDE_FINDER_BANNER_AFTER_USE && (hasUsedFinder() || bookmarks.codes.length > 0)) return null;
  return (
    <button
      type="button"
      className={cx(styles.banner, className)}
      onClick={() => {
        markFinderUsed();
        mode.onSwitch();
      }}
    >
      <span className={styles.icon} aria-hidden="true">
        <img src={NEIGHBORHOOD_ICON} alt="" width={28} height={28} />
      </span>
      <span className={styles.text}>
        <small>어디 살지 고민이라면?</small>
        <strong>출퇴근 시간으로 동네 찾아보기</strong>
      </span>
      <span className={styles.cta} aria-hidden="true">
        동네 찾아보기
        <Icon name="chevron-right" size={14} />
      </span>
    </button>
  );
};

const styles = {
  banner: css`
    label: RecordNeighborhoodBanner-banner;
    position: absolute;
    right: 1.25rem;
    left: 1.25rem;
    z-index: 14;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    box-sizing: border-box;
    height: 4.25rem;
    max-width: 30rem;
    margin-inline: auto;
    padding: 0 1rem;
    border: 0;
    border-radius: 1rem;
    background: #fff;
    box-shadow: 0 4px 16px rgb(0 0 0 / 16%);
    color: var(--color-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
  icon: css`
    label: RecordNeighborhoodBanner-icon;
    display: grid;
    flex: none;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-brand-blue-ink) 12%, #fff);
  `,
  text: css`
    label: RecordNeighborhoodBanner-text;
    display: grid;
    flex: 1;
    min-width: 0;
    gap: 0.15rem;
    letter-spacing: -0.03em;

    & small {
      color: var(--color-muted);
      font-size: 0.75rem;
    }

    & strong {
      color: var(--color-brand-blue-ink);
      font-size: 0.95rem;
      font-weight: 800;
      word-break: keep-all;
    }
  `,
  cta: css`
    label: RecordNeighborhoodBanner-cta;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.2rem;
    padding: 0.4rem 0.6rem 0.4rem 0.75rem;
    border-radius: 999px;
    background: var(--color-brand-blue-ink);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 800;
    white-space: nowrap;
  `,
};

export default RecordNeighborhoodBanner;
