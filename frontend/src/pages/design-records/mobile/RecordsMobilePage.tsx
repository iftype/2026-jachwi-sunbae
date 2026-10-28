import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

import useRecords from '../hooks/useRecords';
import useRecordsAddMode from '../hooks/useRecordsAddMode';
import useRecordsMapLayers from '../hooks/useRecordsMapLayers';
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
import RecordLoadError from '../ui/record-load-error/RecordLoadError';
import RecordNotice from '../ui/record-notice/RecordNotice';
import RecordsMobileMap from './RecordsMobileMap';

import styles from './RecordsMobilePage.module.css';

/**
 * 휴대폰·태블릿 본 방 기록. 위에서 지도·리스트를 바꿔 보고, 지도 보기에서는 헤더와 동네 뱃지를 지도 위에 띄운다.
 * 지도에서 고른 방은 지도 아래 요약 카드로, 리스트에서 고른 방은 상세 화면으로 연다.
 * 지도는 예전 인프라 지도의 시설·거리 메모 카테고리와 찍은 위치의 메모·매물 등록을 함께 맡는다.
 */
const RecordsMobilePage = () => {
  const navigate = useNavigate();
  const records = useRecords();
  const { setNotice } = records;
  // 휴대폰은 지도를 찍어 추가하지 않고, 메모·매물 모두 아래쪽 추가 버튼의 추가 모드에서 위치를 고른다.
  const layers = useRecordsMapLayers(records, { initialCategory: 'MEMO' });
  const addMode = useRecordsAddMode();
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
  // 헤더·동네 뱃지는 지도가 실제로 보일 때만 지도 위에 띄운다. 불러오는 중·실패 안내를 가리지 않게 한다.
  const overMap = showsMap && records.properties.isSuccess;

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={overMap ? styles.mapChrome : undefined}>
          <h1 ref={records.headingRef} className="sr-only" tabIndex={-1}>
            본 방 기록
          </h1>
          {/* 추가 모드에서는 위쪽 탭을 모두 거두고, 그 자리에 지도가 추가 모드 안내 토스트를 띄운다. */}
          {!addMode.isAddMode && (
            <>
              <header className={styles.header}>
                <Link className={styles.back} to={HOME_PATH} aria-label="홈으로 돌아가기">
                  <Icon name="chevron-left" size={24} />
                </Link>
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
                overMap={overMap}
              />
            </>
          )}
        </div>
        <div className={styles.body}>
          {records.properties.isPending ? (
            <RecordListSkeleton className={styles.list} />
          ) : records.properties.isError ? (
            <RecordLoadError
              className={styles.list}
              error={records.properties.error}
              onRetry={() => void records.properties.refetch()}
            />
          ) : showsMap ? (
            <RecordsMobileMap
              records={records}
              layers={layers}
              addMode={addMode}
              onAddProperty={(location) => navigate('/properties/new', { state: { selectedLocation: location } })}
            />
          ) : (
            <RecordList
              className={styles.list}
              records={records.records}
              district={records.district}
              onNotice={setNotice}
            />
          )}
        </div>
        {/* 지도 보기는 지도 안의 매물 추가 버튼을 쓰므로, 리스트 보기에만 기록하기 버튼을 둔다. */}
        {!showsMap && (
          <button type="button" className={styles.add} onClick={() => navigate('/properties/new')}>
            <Icon name="plus" size={20} /> 기록하기
          </button>
        )}
        <RecordNotice message={records.notice} onClose={() => setNotice('')} />
      </div>
    </main>
  );
};

export default RecordsMobilePage;
