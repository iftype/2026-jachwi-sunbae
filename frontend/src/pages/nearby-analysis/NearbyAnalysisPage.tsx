import { useParams, useSearchParams } from 'react-router-dom';

import { readAreaNearbyBackPath, readAreaNearbyTarget } from '@/features/map/lib/areaNearbyTarget';
import { usePropertyDetail } from '@/features/property/api/useProperties';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import { ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import NearbyStage from './ui/nearby-stage/NearbyStage';

import styles from './NearbyAnalysisPage.module.css';

/** `/properties/:propertyId/nearby`는 매물 좌표로, `/explore/nearby`·`/neighborhoods/nearby`는 동네 좌표로 분석한다. */
const NearbyAnalysisPage = () => {
  const { propertyId } = useParams();
  if (propertyId === undefined) return <AreaNearbyAnalysisPage />;
  const parsedPropertyId = parsePositiveId(propertyId);
  if (parsedPropertyId === null)
    return <EmptyState title="올바른 매물 주소가 아니에요" description="매물 목록에서 다시 선택해 주세요." />;
  return <PropertyNearbyAnalysisPage propertyId={parsedPropertyId} />;
};

const PropertyNearbyAnalysisPage = ({ propertyId }: { propertyId: number }) => {
  const property = usePropertyDetail(propertyId);
  const latitude = property.data?.location.latitude ?? null;
  const longitude = property.data?.location.longitude ?? null;
  const hasLocation = latitude !== null && longitude !== null;

  return (
    <main className={styles.page}>
      <TopNavigation
        className={styles.mapNavigation}
        title="매물 주변 분석"
        backTo="/map"
        backLabel="매물 지도로 돌아가기"
      />
      {property.isError ? (
        <div className={styles.fullState}>
          <InlineNotice tone="error">매물 위치를 불러오지 못했어요.</InlineNotice>
          <button type="button" onClick={() => void property.refetch()}>
            다시 시도
          </button>
        </div>
      ) : !property.isPending && !hasLocation ? (
        <div className={styles.fullState}>
          <EmptyState
            title="먼저 매물 위치를 등록해 주세요"
            description="위치를 저장하면 반경별 주변 시설을 분석할 수 있어요."
            action={<ButtonLink to={`/properties/${propertyId}/edit`}>위치 등록하기</ButtonLink>}
          />
        </div>
      ) : (
        <NearbyStage
          subjectId={propertyId}
          center={hasLocation ? { latitude, longitude } : null}
          headingPrefix={`${property.data?.name ?? '선택한'} 매물`}
          label="매물 주변 분석 지도"
          isSubjectPending={property.isPending}
        />
      )}
    </main>
  );
};

/** 동네 탐색 결과의 중심 좌표로 정류장·공인중개사 같은 주변 시설을 본다. 토큰이 없으면 API 클라이언트가 먼저 자동 로그인한다. */
const AreaNearbyAnalysisPage = () => {
  const [params] = useSearchParams();
  const target = readAreaNearbyTarget(params);
  const backTo = readAreaNearbyBackPath(params);

  return (
    <main className={styles.page}>
      <TopNavigation
        className={styles.mapNavigation}
        title="동네 주변 분석"
        backTo={backTo}
        backLabel="동네 지도로 돌아가기"
      />
      {target === null ? (
        <div className={styles.fullState}>
          <EmptyState
            title="동네 위치를 찾지 못했어요"
            description="동네 지도에서 다시 선택해 주세요."
            action={<ButtonLink to={backTo}>동네 지도로 가기</ButtonLink>}
          />
        </div>
      ) : (
        <NearbyStage
          subjectId={`area-${target.latitude}-${target.longitude}`}
          center={{ latitude: target.latitude, longitude: target.longitude }}
          markerLabel={target.name}
          initialCategories={['TRANSPORT', 'AGENCY']}
          headingPrefix={target.name}
          label="동네 주변 분석 지도"
          isSubjectPending={false}
        />
      )}
    </main>
  );
};

export default NearbyAnalysisPage;
