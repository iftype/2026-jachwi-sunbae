import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import CreatePropertyPage from '@/pages/create-property/CreatePropertyPage';
import PropertyDetailPage from '@/pages/property-detail/PropertyDetailPage';
import type { MapAddress } from '@/features/map/model/Map';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import DesktopHeader from '@/shared/ui/desktop-header/DesktopHeader';

import useRecords from '../hooks/useRecords';
import useRecordsMapLayers from '../hooks/useRecordsMapLayers';
import RecordDistricts from '../ui/record-districts/RecordDistricts';
import RecordList from '../ui/record-list/RecordList';
import RecordListSkeleton from '../ui/record-list/RecordListSkeleton';
import RecordLoadError from '../ui/record-load-error/RecordLoadError';
import RecordNotice from '../ui/record-notice/RecordNotice';
import RecordsDesktopMap from './RecordsDesktopMap';

import styles from './RecordsDesktopPage.module.css';

/**
 * 데스크탑 본 방 기록. 왼쪽 칸에 리스트, 오른쪽에 지도를 두고 보기 전환 없이 함께 본다.
 * 리스트나 지도에서 고른 방(`/properties/:propertyId`)과 새 매물 등록은 다른 화면으로 넘어가지 않고 왼쪽 칸에 연다.
 * 새 매물은 따로 둔 기록하기 버튼 없이 지도에서 위치를 찍어 등록하고, 찍은 주소·좌표를 등록 칸에 미리 채운다.
 * 지도는 예전 인프라 지도의 시설·거리 메모 카테고리와 찍은 위치의 메모·매물 등록을 함께 맡는다.
 */
const RecordsDesktopPage = () => {
  const navigate = useNavigate();
  const records = useRecords({
    selectedId: useParams().propertyId ?? null,
    setSelectedId: (id) => navigate(id === null ? RECORDS_PATH : `${RECORDS_PATH}/${id}`),
  });
  const { selected, setSelectedId, setNotice } = records;
  // 지도에서 찍어 연 새 매물 등록 칸의 위치. 없으면 등록 칸을 닫은 상태다.
  const [creatingAt, setCreatingAt] = useState<MapAddress | null>(null);
  const layers = useRecordsMapLayers(records, {
    onRegister: (location) => {
      setSelectedId(null);
      setCreatingAt(location);
    },
  });
  const showsSelectedPanel = creatingAt === null && selected !== undefined;

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <DesktopHeader />
        <h1 ref={records.headingRef} className="sr-only" tabIndex={-1}>
          본 방 기록
        </h1>
        <div className={styles.body}>
          {records.properties.isPending ? (
            <RecordListSkeleton className={styles.list} />
          ) : records.properties.isError ? (
            <RecordLoadError
              className={styles.list}
              error={records.properties.error}
              onRetry={() => void records.properties.refetch()}
            />
          ) : (
            <>
              <RecordsDesktopMap
                records={records}
                layers={layers}
                className={styles.map}
                districts={
                  <RecordDistricts
                    districts={records.districts}
                    district={records.district}
                    onSelect={records.selectDistrict}
                    overMap
                  />
                }
              />
              {creatingAt !== null ? (
                <aside className={`${styles.list} ${styles.sidePanel}`} aria-label="새 매물 등록 패널">
                  <CreatePropertyPage
                    // 다른 위치를 찍어 다시 열면 입력을 처음부터 시작한다.
                    key={`${creatingAt.latitude},${creatingAt.longitude}`}
                    panel={{
                      initialLocation: creatingAt,
                      onClose: () => setCreatingAt(null),
                      onCreated: (propertyId) => {
                        setCreatingAt(null);
                        records.setDistrict('전체');
                        setSelectedId(String(propertyId));
                        setNotice('매물을 기록했어요.');
                      },
                    }}
                  />
                </aside>
              ) : showsSelectedPanel ? (
                <aside className={`${styles.list} ${styles.sidePanel}`} aria-label="선택한 매물 상세">
                  <PropertyDetailPage
                    key={selected.id}
                    panel={{ propertyId: Number(selected.id), onClose: () => setSelectedId(null) }}
                  />
                </aside>
              ) : (
                <RecordList
                  className={styles.list}
                  records={records.records}
                  district={records.district}
                  onOpen={setSelectedId}
                  onNotice={setNotice}
                />
              )}
            </>
          )}
        </div>
        <RecordNotice message={records.notice} onClose={() => setNotice('')} className={styles.notice} />
      </div>
    </main>
  );
};

export default RecordsDesktopPage;
