import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  addRecentAddress,
  clearRecentAddresses,
  readRecentAddresses,
  recentAddressLabel,
  removeRecentAddress,
} from '@/features/map/lib/recentAddressStore';
import type { SearchedAddressState } from '@/features/map/lib/searchedAddressState';
import type { MapAddress } from '@/features/map/model/Map';
import { usePropertyList } from '@/features/property/api/useProperties';
import {
  ADDRESS_SEARCH_TARGET_PARAM,
  NEIGHBORHOODS_PATH,
  RECORDS_MAP_PATH,
  RECORDS_VIEW_PARAM,
} from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';
import StateIllustration from '@/shared/ui/state-illustration/StateIllustration';

import { recordPresentation } from '../design-records/model/recordPresentation';
import { writeLastRecordsView } from '../design-records/model/recordsView';
import RecordAddressSearch from '../design-records/ui/record-address-search/RecordAddressSearch';

/**
 * 휴대폰 주소 검색 화면. 위에 뒤로가기와 검색창을 두고, 입력 전에는 최근 검색을 보여 준다.
 * 주소를 고르면 기록 지도로 돌아가 그 자리로 옮기고, 고른 주소는 최근 검색에 기기에만 남긴다.
 */
const AddressSearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDestinationSearch = searchParams.get(ADDRESS_SEARCH_TARGET_PARAM) === 'neighborhoods';
  const returnPath = isDestinationSearch ? `${NEIGHBORHOODS_PATH}?${RECORDS_VIEW_PARAM}=map` : RECORDS_MAP_PATH;
  const properties = usePropertyList();
  // 위치가 있는 내 기록만 모은다. 누르면 그 자리로 지도를 옮긴다.
  const myRecords = useMemo(
    () =>
      (properties.data?.pages.flatMap((page) => page.content) ?? []).map(recordPresentation).flatMap((record) => {
        const { latitude, longitude } = record;
        return latitude === null || longitude === null ? [] : [{ ...record, latitude, longitude }];
      }),
    [properties.data],
  );
  const [recents, setRecents] = useState(readRecentAddresses);

  const pick = (address: MapAddress) => {
    addRecentAddress(address);
    writeLastRecordsView('map');
    const state: SearchedAddressState = { searchedAddress: address };
    navigate(returnPath, { state, replace: isDestinationSearch });
  };

  return (
    <main className={styles.page}>
      <h1 className="sr-only">{isDestinationSearch ? '출퇴근하는 장소 검색' : '주소 검색'}</h1>
      {/* 뒤로가기는 검색창 밖에 따로 둔다. 검색창 안에는 돋보기만 둔다. */}
      <div className={styles.top}>
        <button type="button" className={styles.back} aria-label="뒤로 가기" onClick={() => navigate(-1)}>
          <Icon name="arrow-left" size={22} />
        </button>
        <RecordAddressSearch
          autoFocus
          onSelect={pick}
          label={isDestinationSearch ? '출퇴근하는 장소 검색' : '주소 검색'}
          placeholder={isDestinationSearch ? '출퇴근하는 장소' : '주소로 지도 이동'}
        />
      </div>
      {isDestinationSearch && (
        <button
          className={styles.mapPick}
          type="button"
          onClick={() => navigate(returnPath, { replace: true, state: { selectDestinationOnMap: true } })}
        >
          <Icon name="map" size={18} />
          지도에서 직접 고르기
        </button>
      )}
      {recents.length === 0 && myRecords.length === 0 ? (
        <section className={styles.emptyState} aria-label="검색 안내">
          <StateIllustration name="empty-search" size={7} />
          <h2>어디로 이동할까요?</h2>
          <p className={styles.empty}>
            {properties.isPending
              ? '불러오는 중이에요.'
              : '최근 검색과 위치가 있는 기록이 아직 없어요. 주소를 찾아 보세요.'}
          </p>
        </section>
      ) : (
        <>
          {recents.length > 0 && (
            <section className={styles.recents} aria-label="최근 검색">
              <div className={styles.recentsHead}>
                <h2>최근 검색</h2>
                <button type="button" onClick={() => setRecents(clearRecentAddresses())}>
                  전체 삭제
                </button>
              </div>
              <ul>
                {recents.map((address) => (
                  <li key={recentAddressLabel(address)}>
                    <button type="button" className={styles.item} onClick={() => pick(address)}>
                      <Icon name="search" size={18} />
                      <span>{recentAddressLabel(address)}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`${recentAddressLabel(address)} 삭제`}
                      onClick={() => setRecents(removeRecentAddress(address))}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {myRecords.length > 0 && (
            <section className={styles.recents} aria-label="내 기록">
              <div className={styles.recentsHead}>
                <h2>내 기록</h2>
              </div>
              <ul>
                {myRecords.map((record) => (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={styles.item}
                      onClick={() =>
                        pick({
                          address: null,
                          roadAddress: record.note,
                          jibunAddress: null,
                          latitude: record.latitude,
                          longitude: record.longitude,
                        })
                      }
                    >
                      <Icon name="map" size={18} />
                      <span>
                        {record.name}, {record.note}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
};

const styles = {
  mapPick: css`
    label: AddressSearchPage-mapPick;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0.5rem auto;
    padding: 0.75rem 1rem;
    border: 0;
    border-radius: var(--radius-card);
    color: var(--color-brand-blue-ink);
    background: var(--color-surface-muted);
    font: inherit;
    cursor: pointer;
  `,
  emptyState: css`
    label: AddressSearchPage-emptyState;
    display: grid;
    justify-items: center;
    gap: var(--space-sm);
    margin: clamp(2rem, 10vh, 5rem) auto 0;
    padding: 0 var(--space-lg);
    max-width: 25rem;
    text-align: center;
    & h2 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--color-ink);
    }
    & p {
      padding: 0;
      line-height: 1.6;
    }
  `,
  page: css`
    label: AddressSearchPage-page;
    min-height: 100dvh;
    background: white;
  `,
  top: css`
    label: AddressSearchPage-top;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: calc(env(safe-area-inset-top) + 0.75rem) 0.75rem 0.5rem 0.25rem;
  `,
  back: css`
    label: AddressSearchPage-back;
    display: grid;
    place-items: center;
    flex: none;
    width: 2.75rem;
    height: 2.75rem;
    border: 0;
    background: none;
    color: var(--color-ink);
    cursor: pointer;
  `,
  recents: css`
    label: AddressSearchPage-recents;
    padding: 0.5rem 0.75rem;
    & ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    & li {
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--color-border);
    }
  `,
  recentsHead: css`
    label: AddressSearchPage-recentsHead;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    & h2 {
      margin: 0;
      font-size: 0.9rem;
    }
    & button {
      border: 0;
      background: none;
      color: #6b7079;
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
    }
  `,
  item: css`
    label: AddressSearchPage-item;
    display: flex;
    flex: 1;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    padding: 0.85rem 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
    & span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  remove: css`
    label: AddressSearchPage-remove;
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 0;
    background: none;
    color: #8a8f98;
    cursor: pointer;
  `,
  empty: css`
    label: AddressSearchPage-empty;
    margin: 0;
    padding: 1rem 0;
    color: #6b7079;
    font-size: 0.85rem;
  `,
};

export default AddressSearchPage;
