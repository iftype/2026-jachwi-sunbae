import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import { HOME_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

import useRecords from '../hooks/useRecords';
import {
  parseRecordsView,
  readLastRecordsView,
  RECORDS_VIEW_PARAM,
  type RecordsView,
  writeLastRecordsView,
} from '../model/recordsView';
import RecordDistricts from '../ui/record-districts/RecordDistricts';
import RecordList from '../ui/record-list/RecordList';
import RecordListSkeleton from '../ui/record-list/RecordListSkeleton';
import RecordNotice from '../ui/record-notice/RecordNotice';
import RecordsMap from '../ui/records-map/RecordsMap';

import shared from '../RecordsPage.module.css';
import styles from './RecordsMobilePage.module.css';

/**
 * 휴대폰·태블릿 본 방 기록. 위에서 지도·리스트를 바꿔 보고, 지도 보기에서는 헤더와 동네 뱃지를 지도 위에 띄운다.
 * 지도에서 고른 방은 지도 아래 요약 카드로, 리스트에서 고른 방은 상세 화면으로 연다.
 */
const RecordsMobilePage = () => {
  const navigate = useNavigate();
  const records = useRecords();
  const { selected, setSelectedId, setNotice } = records;
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseRecordsView(searchParams.get(RECORDS_VIEW_PARAM)) ?? readLastRecordsView();
  // 보기 방식을 주소에 남겨, 상세·체크리스트에서 뒤로 돌아와도 보던 보기(리스트 등)로 열리게 한다.
  const setView = (next: RecordsView) => {
    writeLastRecordsView(next);
    setSearchParams(
      (current) => {
        current.set(RECORDS_VIEW_PARAM, next);
        return current;
      },
      { replace: true },
    );
  };
  const showsMap = view === 'map';

  return (
    <main className={`${shared.page} ${styles.root}`}>
      <div className={shared.frame}>
        <div className={showsMap ? styles.mapChrome : undefined}>
          <header className={styles.header}>
            <Link className={styles.back} to={HOME_PATH} aria-label="홈으로 돌아가기">
              <Icon name="chevron-left" size={24} />
            </Link>
            <h1 ref={records.headingRef} className="sr-only" tabIndex={-1}>
              본 방 기록
            </h1>
            <nav className={styles.switch} aria-label="기록 보기 방식">
              <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
                <Icon name="map" size={17} /> 지도
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <Icon name="checklist" size={17} /> 리스트
              </button>
            </nav>
          </header>
          <RecordDistricts
            districts={records.districts}
            district={records.district}
            onSelect={records.selectDistrict}
            overMap={showsMap}
          />
        </div>
        <div className={shared.body}>
          {records.properties.isPending ? (
            <RecordListSkeleton className={shared.list} />
          ) : records.properties.isError ? (
            <div className={shared.list} role="alert">
              기록을 불러오지 못했어요.{' '}
              <button type="button" onClick={() => void records.properties.refetch()}>
                다시 시도
              </button>
            </div>
          ) : showsMap ? (
            <RecordsMap records={records} recenterClassName={styles.recenterBelowChrome}>
              {selected && (
                <article className={styles.selectedCard}>
                  <Link
                    className={styles.selectedMain}
                    to={`/properties/${selected.id}`}
                    state={{ returnTo: RECORDS_PATH }}
                  >
                    {selected.representativePhoto ? (
                      <AuthenticatedPhoto
                        propertyId={Number(selected.id)}
                        photoId={selected.representativePhoto.photoId}
                        contentUrl={selected.representativePhoto.contentUrl}
                        alt={`${selected.name} 대표 사진`}
                        className={styles.selectedPhoto}
                      />
                    ) : (
                      <span className={styles.selectedPhotoFallback} aria-hidden="true">
                        <Icon name="home" size={22} />
                      </span>
                    )}
                    <span className={styles.selectedDetails}>
                      <strong>{selected.name}</strong>
                      <span>{selected.price}</span>
                    </span>
                  </Link>
                  <button
                    className={styles.dismissCard}
                    type="button"
                    aria-label="매물 카드 닫기"
                    onClick={() => setSelectedId(null)}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </article>
              )}
            </RecordsMap>
          ) : (
            <RecordList
              className={shared.list}
              records={records.records}
              district={records.district}
              onNotice={setNotice}
            />
          )}
        </div>
        {!(showsMap && selected) && (
          <button type="button" className={shared.add} onClick={() => navigate('/properties/new')}>
            <Icon name="plus" size={20} /> 기록하기
          </button>
        )}
        <RecordNotice message={records.notice} onClose={() => setNotice('')} />
      </div>
    </main>
  );
};

export default RecordsMobilePage;
