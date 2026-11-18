import { css } from '@emotion/css';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import MapHeaderWeather from '@/features/weather/ui/map-header-weather/MapHeaderWeather';
import { LOGO_DUCK } from '@/shared/assets/imageAssets';
import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import { MapModeSwitchTile, useHasMapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';
import MobileMapHeader from '@/shared/ui/mobile-map-header/MobileMapHeader';

import type { RecordsView } from '../model/recordsView';

type Props = {
  view: RecordsView;
  onViewChange: (view: RecordsView) => void;
  searchTo?: string;
};
/**
 * 휴대폰 기록 헤더. 지도 보기에서는 왼쪽에 동네 찾기와 내 기록을 오가는 타일을, 리스트 보기와 통합 지도 밖에서는 로고를 둔다.
 */
const RecordsMobileHeader = ({ view, searchTo }: Props) => {
  const showsModeTile = useHasMapModeSwitch() && view === 'map';
  // 검색 아이콘을 누르면 바로 열리도록, 주소 검색 화면 코드를 미리 받아 둔다.
  useEffect(() => {
    void import('@/pages/address-search/AddressSearchPage');
  }, []);
  return (
    <div className={styles.header}>
      <MobileMapHeader
        searchTo={searchTo}
        hideSearch={view === 'list'}
        center={view === 'list' ? <MapHeaderWeather /> : undefined}
        leading={
          showsModeTile ? (
            <MapModeSwitchTile />
          ) : (
            <Link to={HOME_PATH} aria-label="자취선배 홈" className={styles.logo}>
              <img
                src={LOGO_DUCK.src}
                srcSet={`${LOGO_DUCK.src} 1x, ${LOGO_DUCK.src2x} 2x`}
                alt=""
                width={44}
                height={44}
              />
            </Link>
          )
        }
      />
    </div>
  );
};
const styles = {
  logo: css`
    label: RecordsMobileHeader-logo;
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
  header: css`
    label: RecordsMobileHeader-root;
    padding: calc(env(safe-area-inset-top) + 0.75rem) 0.85rem 0.5rem;
  `,
};
export default RecordsMobileHeader;
