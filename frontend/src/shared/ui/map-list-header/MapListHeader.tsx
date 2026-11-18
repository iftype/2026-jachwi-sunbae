import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { LOGO_DUCK } from '@/shared/assets/imageAssets';
import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import MapProfileLink from '@/shared/ui/map-profile-link/MapProfileLink';

type Props = {
  children?: ReactNode;
  center?: ReactNode;
  className?: string;
  /** 켜면 아래 검색 줄을 두지 않는다. 검색은 가운데 칸(`center`)이나 `actions`의 버튼으로 연다. */
  searchInRow?: boolean;
  /** 프로필 버튼 왼쪽에 둘 버튼들. */
  actions?: ReactNode;
  /** 주면 왼쪽 위 로고 자리에 이것을 둔다. */
  leading?: ReactNode;
};

const MapListHeader = ({ children, center, className, searchInRow = false, actions, leading }: Props) => (
  <header className={`${styles.header} ${className ?? ''}`.trim()} aria-label="지도 목록 헤더">
    <div className={styles.row}>
      {leading ?? (
        <Link to={HOME_PATH} className={styles.logo} aria-label="자취선배 홈">
          <img
            src={LOGO_DUCK.src}
            srcSet={`${LOGO_DUCK.src} 1x, ${LOGO_DUCK.src2x} 2x`}
            alt=""
            width={44}
            height={44}
          />
        </Link>
      )}
      <div className={styles.center}>{center}</div>
      {actions}
      <MapProfileLink />
    </div>
    {!searchInRow && (
      <div className={styles.search}>
        {children ?? (
          <input className={styles.placeholder} aria-label="주소 검색" placeholder="주소로 지도 이동" disabled />
        )}
      </div>
    )}
  </header>
);
const styles = {
  placeholder: css`
    label: MapListHeader-placeholder;
    width: 100%;
    min-width: 0;
    height: 2.65rem;
    padding: 0 0.8rem;
    border: 1px solid var(--color-border);
    border-radius: 2rem;
    background: white;
    font: inherit;
    font-size: 0.85rem;
    opacity: 0.6;
  `,
  header: css`
    label: MapListHeader-header;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: none !important;
    width: 100%;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
    background: white;
    pointer-events: auto;
  `,
  row: css`
    label: MapListHeader-row;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
  `,
  center: css`
    label: MapListHeader-center;
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: center;
  `,
  logo: css`
    label: MapListHeader-logo;
    display: block;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.75rem;
    overflow: hidden;
    & img {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  search: css`
    label: MapListHeader-search;
    position: relative;
    min-width: 0;
    width: 100%;
  `,
};
export default MapListHeader;
