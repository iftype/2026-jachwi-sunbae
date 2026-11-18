import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { LOGO_DUCK } from '@/shared/assets/imageAssets';
import { ADDRESS_SEARCH_PATH, HOME_PATH } from '@/shared/lib/navigation/appPaths';

import Icon from '../icon/Icon';
import MapProfileLink from '../map-profile-link/MapProfileLink';

type Props = {
  trailing?: ReactNode;
  leading?: ReactNode;
  center?: ReactNode;
  hideSearch?: boolean;
  searchTo?: string;
  searchLabel?: string;
  centered?: boolean;
};
export const MapHomeLink = () => (
  <Link to={HOME_PATH} aria-label="자취선배 홈" className={styles.logo}>
    <img src={LOGO_DUCK.src} srcSet={`${LOGO_DUCK.src} 1x, ${LOGO_DUCK.src2x} 2x`} alt="" width={44} height={44} />
  </Link>
);
const MobileMapHeader = ({
  leading,
  trailing,
  center,
  hideSearch = false,
  searchTo = ADDRESS_SEARCH_PATH,
  searchLabel = '주소 검색',
  centered = false,
}: Props) => (
  <header className={styles.header} data-centered={centered || undefined} aria-label="지도 목록 헤더">
    <div className={styles.leading}>{leading}</div>
    <div className={styles.space}>{center}</div>
    <div className={styles.actions}>
      {!hideSearch && (
        <Link to={searchTo} className={styles.search} aria-label={searchLabel}>
          <Icon name="search" size={20} />
        </Link>
      )}
      {trailing}
      <MapProfileLink />
    </div>
  </header>
);
const styles = {
  header: css`
    label: MobileMapHeader-root;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 2.75rem;
    pointer-events: auto;

    &[data-centered='true'] {
      display: grid;
      grid-template-columns: 5.25rem minmax(0, 1fr) 5.25rem;
      gap: 0.25rem;
    }
  `,
  leading: css`
    &:empty {
      display: none;
    }
  `,
  actions: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  `,
  logo: css`
    display: block;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--radius-md);
    overflow: hidden;

    & img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,
  space: css`
    label: MobileMapHeader-space;
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: center;
  `,
  search: css`
    label: MobileMapHeader-search;
    display: grid;
    place-items: center;
    flex: none;
    width: 2.5rem;
    height: 2.5rem;
    border: 0;
    border-radius: 50%;
    color: var(--color-ink);
    background: var(--color-surface);
    text-decoration: none;
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
    }
  `,
};
export default MobileMapHeader;
