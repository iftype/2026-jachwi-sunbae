import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ADDRESS_SEARCH_PATH } from '@/shared/lib/navigation/appPaths';

import Icon from '../icon/Icon';
import MapProfileLink from '../map-profile-link/MapProfileLink';

type Props = {
  trailing?: ReactNode;
  leading?: ReactNode;
  center?: ReactNode;
  hideSearch?: boolean;
  searchTo?: string;
  searchLabel?: string;
};
const MobileMapHeader = ({
  leading,
  trailing,
  center,
  hideSearch = false,
  searchTo = ADDRESS_SEARCH_PATH,
  searchLabel = '주소 검색',
}: Props) => (
  <header className={styles.header} aria-label="지도 목록 헤더">
    {leading}
    <div className={styles.space}>{center}</div>
    {!hideSearch && (
      <Link to={searchTo} className={styles.search} aria-label={searchLabel}>
        <Icon name="search" size={20} />
      </Link>
    )}
    {trailing}
    <MapProfileLink />
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
