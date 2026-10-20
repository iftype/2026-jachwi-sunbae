import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import CreatePropertyPage from '@/pages/create-property/CreatePropertyPage';
import PropertyDetailPage from '@/pages/property-detail/PropertyDetailPage';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import DesktopHeader from '@/shared/ui/desktop-header/DesktopHeader';
import Icon from '@/shared/ui/icon/Icon';

import useRecords from '../hooks/useRecords';
import RecordDistricts from '../ui/record-districts/RecordDistricts';
import RecordList from '../ui/record-list/RecordList';
import RecordListSkeleton from '../ui/record-list/RecordListSkeleton';
import RecordNotice from '../ui/record-notice/RecordNotice';
import RecordsMap from '../ui/records-map/RecordsMap';

import shared from '../RecordsPage.module.css';
import styles from './RecordsDesktopPage.module.css';

/**
 * 데스크탑 본 방 기록. 왼쪽 칸에 리스트, 오른쪽에 지도를 두고 보기 전환 없이 함께 본다.
 * 리스트나 지도에서 고른 방(`/properties/:propertyId`)과 새 매물 등록은 다른 화면으로 넘어가지 않고 왼쪽 칸에 연다.
 */
const RecordsDesktopPage = () => {
  const navigate = useNavigate();
  const records = useRecords({
    selectedId: useParams().propertyId ?? null,
    setSelectedId: (id) => navigate(id === null ? RECORDS_PATH : `${RECORDS_PATH}/${id}`),
  });
  const { selected, setSelectedId, setNotice } = records;
  const [creating, setCreating] = useState(false);
  const showsSelectedPanel = !creating && selected !== undefined;

  return (
    <main className={`${shared.page} ${styles.root}`}>
      <div className={`${shared.frame} ${styles.frame}`}>
        <DesktopHeader />
        <h1 ref={records.headingRef} className="sr-only" tabIndex={-1}>
          본 방 기록
        </h1>
        <div className={`${shared.body} ${styles.body}`}>
          {records.properties.isPending ? (
            <RecordListSkeleton className={`${shared.list} ${styles.list}`} />
          ) : records.properties.isError ? (
            <div className={`${shared.list} ${styles.list}`} role="alert">
              기록을 불러오지 못했어요.{' '}
              <button type="button" onClick={() => void records.properties.refetch()}>
                다시 시도
              </button>
            </div>
          ) : (
            <>
              <RecordsMap records={records} className={styles.map} hintClassName={styles.hint}>
                <RecordDistricts
                  districts={records.districts}
                  district={records.district}
                  onSelect={records.selectDistrict}
                  overMap
                  className={styles.districts}
                />
              </RecordsMap>
              {creating ? (
                <aside className={`${shared.list} ${styles.list} ${styles.sidePanel}`} aria-label="새 매물 등록 패널">
                  <CreatePropertyPage
                    panel={{
                      onClose: () => setCreating(false),
                      onCreated: (propertyId) => {
                        setCreating(false);
                        records.setDistrict('전체');
                        setSelectedId(String(propertyId));
                        setNotice('매물을 기록했어요.');
                      },
                    }}
                  />
                </aside>
              ) : showsSelectedPanel ? (
                <aside className={`${shared.list} ${styles.list} ${styles.sidePanel}`} aria-label="선택한 매물 상세">
                  <PropertyDetailPage
                    key={selected.id}
                    panel={{ propertyId: Number(selected.id), onClose: () => setSelectedId(null) }}
                  />
                </aside>
              ) : (
                <RecordList
                  className={`${shared.list} ${styles.list}`}
                  records={records.records}
                  district={records.district}
                  onOpen={setSelectedId}
                  onNotice={setNotice}
                />
              )}
            </>
          )}
        </div>
        {!creating && (
          <button type="button" className={`${shared.add} ${styles.add}`} onClick={() => setCreating(true)}>
            <Icon name="plus" size={20} /> 기록하기
          </button>
        )}
        <RecordNotice message={records.notice} onClose={() => setNotice('')} className={styles.notice} />
      </div>
    </main>
  );
};

export default RecordsDesktopPage;
