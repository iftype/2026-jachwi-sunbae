import { useParams } from 'react-router-dom';

import PropertyActiveChecklistPage from '@/pages/property-active-checklist/PropertyActiveChecklistPage';
import PropertyDetailPage from '@/pages/property-detail/PropertyDetailPage';
import MapHeaderWeather from '@/features/weather/ui/map-header-weather/MapHeaderWeather';
import AreaSkeleton from '@/shared/ui/area-skeleton/AreaSkeleton';
import { DesktopHeaderSlotProvider } from '@/shared/ui/desktop-header/DesktopHeaderSlot';
import DetailHeader from '@/shared/ui/detail-header/DetailHeader';
import ListDetailLayout from '@/shared/ui/list-detail-layout/ListDetailLayout';
import MapListHeader from '@/shared/ui/map-list-header/MapListHeader';
import { useMapPanel } from '@/shared/ui/map-list-header/MapPanelContext';

import type { RecordsState } from '../hooks/useRecords';
import type { RecordsMapLayers } from '../hooks/useRecordsMapLayers';
import { recordNeighbors } from '../model/recordNavigation';
import { RECORDS_LOADING_LABEL } from '../RecordsPageSkeleton';
import RecordAddressSearch from '../ui/record-address-search/RecordAddressSearch';
import RecordDistricts from '../ui/record-districts/RecordDistricts';
import RecordGroupList from '../ui/record-group/RecordGroupList';
import RecordList from '../ui/record-list/RecordList';
import RecordLoadError from '../ui/record-load-error/RecordLoadError';
import RecordNotice from '../ui/record-notice/RecordNotice';
import RecordStepper from '../ui/record-stepper/RecordStepper';
import RecordsDesktopMap from './RecordsDesktopMap';

import * as detailStyles from './RecordsDesktopDetail.styles';
import * as styles from './RecordsDesktopPage.styles';

/**
 * 데스크탑 본 방 기록. 왼쪽 칸에 리스트, 오른쪽에 지도를 두고 보기 전환 없이 함께 본다.
 * 리스트 위 `통근 시간`과 통근거리 줄은 휴대폰 리스트와 같이 둔다.
 * 리스트에서 방을 고르면 지도도 그 방 핀 자리로 옮긴다.
 * 리스트나 지도에서 고른 방(`/properties/:propertyId`)은 동네 찾기처럼 리스트 옆 칸에 연다.
 * 리스트를 덮지 않으므로 상세를 연 채로 다른 방을 바로 고를 수 있고, 지도 왼쪽 위 닫기 버튼으로 칸을 접는다.
 * 새 매물은 지도에서 위치를 찍어 등록 화면 없이 바로 만들고(이름은 `새 매물`), 만든 매물의 상세를 옆 칸에 연다.
 * 지도는 예전 인프라 지도의 시설·거리 메모 카테고리와 찍은 위치의 메모·매물 등록을 함께 맡는다.
 */
type Props = { records: RecordsState; layers: RecordsMapLayers };
const RecordsDesktopPage = ({ records, layers }: Props) => {
  const panel = useMapPanel();
  const params = useParams();
  const isReplacingChecklist = params.stage !== undefined;
  const { selected, setSelectedId, setNotice } = records;
  const closeDetail = () => setSelectedId(null);

  // 처음 여는 화면이라 남겨 둘 목록이 없다. 늦추지 않고 바로 뼈대를 보여, 화면 코드를 받는 동안의 뼈대(`RecordsPageSkeleton`)에서 이어지게 한다.
  const list = records.properties.isPending ? (
    <AreaSkeleton area="list" label={RECORDS_LOADING_LABEL} />
  ) : records.properties.isError ? (
    <RecordLoadError
      className={styles.list}
      error={records.properties.error}
      onRetry={() => void records.properties.refetch()}
    />
  ) : layers.groupRecords.length > 0 ? (
    // 겹친 매물 마커를 누르면 맨 왼쪽 리스트가 그 자리 매물 목록으로 바뀌고, 뒤로가기로 원래 리스트로 돌아간다.
    <div className={styles.list}>
      <DetailHeader
        title={`이 자리 매물 ${layers.groupRecords.length}개`}
        backLabel="전체 리스트로 돌아가기"
        onBack={layers.closeGroup}
      />
      <RecordGroupList records={layers.groupRecords} onOpen={records.showRecord} onNotice={setNotice} />
    </div>
  ) : records.district !== '전체' ? (
    // 동네 뱃지를 고르면 맨 왼쪽 리스트가 그 동네 목록으로 바뀌고, 뒤로가기로 전체 리스트로 돌아간다. 옆으로 나오는 칸은 상세만 쓴다.
    <div className={styles.list}>
      <DetailHeader
        title={`${records.district} 매물 ${records.records.length}개`}
        backLabel="전체 리스트로 돌아가기"
        onBack={() => records.selectDistrict('전체')}
      />
      <RecordList
        records={records.records}
        district={records.district}
        onOpen={records.showRecord}
        onNotice={setNotice}
      />
    </div>
  ) : (
    <RecordList
      className={styles.list}
      records={records.records}
      district={records.district}
      onOpen={records.showRecord}
      onNotice={setNotice}
    />
  );

  // 상세 칸 머리의 이전, 다음은 리스트 순서대로 넘기고, 지도도 그 매물 자리로 옮긴다.
  const neighbors = selected !== undefined ? recordNeighbors(records.records, selected.id) : null;
  const detail =
    selected !== undefined ? (
      <aside
        className={detailStyles.detail}
        aria-label="선택한 매물 상세"
        data-checklist-replacement={isReplacingChecklist || undefined}
      >
        <div className={detailStyles.detailScroll} key={`${selected.id}:${isReplacingChecklist}`}>
          {isReplacingChecklist ? (
            <PropertyActiveChecklistPage embedded />
          ) : (
            <PropertyDetailPage
              key={selected.id}
              panel={{
                propertyId: Number(selected.id),
                onClose: () => setSelectedId(null),
                headerEnd: neighbors && <RecordStepper neighbors={neighbors} onStep={records.showRecord} />,
              }}
            />
          )}
        </div>
      </aside>
    ) : undefined;

  return (
    // 이 화면은 공용 레이아웃 밖에서 열려 헤더 가운데 자리를 직접 마련한다.
    <DesktopHeaderSlotProvider>
      <main className={styles.page}>
        <div className={styles.frame}>
          <h1 ref={records.headingRef} className="sr-only" tabIndex={-1}>
            본 방 기록
          </h1>
          <ListDetailLayout
            className={styles.body}
            floating
            list={
              <>
                {!panel && (
                  <MapListHeader center={<MapHeaderWeather />}>
                    <RecordAddressSearch onSelect={records.moveTo} />
                  </MapListHeader>
                )}
                {panel?.content ?? list}
              </>
            }
            detail={panel ? undefined : detail}
            onCloseDetail={closeDetail}
            closeLabel="매물 상세 칸 닫기"
          >
            {/* 기록을 받는 동안 지도 칸도 화면 코드를 받는 동안의 뼈대와 같은 지도 영역 뼈대로 채운다. 알림은 목록 영역이 맡는다. */}
            {records.properties.isPending && <AreaSkeleton area="map" />}
            {!records.properties.isPending && !records.properties.isError && (
              <RecordsDesktopMap
                records={records}
                layers={layers}
                className={styles.map}
                districts={
                  <RecordDistricts
                    districts={records.districts}
                    counts={records.districtCounts}
                    district={records.district}
                    onSelect={records.selectDistrict}
                    overMap
                    desktopMap
                  />
                }
              />
            )}
          </ListDetailLayout>
          <RecordNotice message={records.notice} onClose={() => setNotice('')} className={styles.notice} />
        </div>
      </main>
    </DesktopHeaderSlotProvider>
  );
};

export default RecordsDesktopPage;
