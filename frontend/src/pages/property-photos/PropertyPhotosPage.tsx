import { css } from '@emotion/css';
import { Link, useLocation, useParams } from 'react-router-dom';

import { describePropertyLoadError } from '@/features/property/api/propertyErrorMessages';
import { usePropertyDetail } from '@/features/property/api/useProperties';
import { cameFromPropertyDetail } from '@/features/property/lib/propertyNavigation';
import { parsePropertyRouteId } from '@/features/property/model/sampleProperties';
import PropertyPhotoManager from '@/features/property/ui/property-photo-manager/PropertyPhotoManager';
import { HOME_PATH, propertyDetailPath } from '@/shared/lib/navigation/appPaths';
import useReturnNavigation from '@/shared/lib/navigation/useReturnNavigation';
import ContentState from '@/shared/ui/content-state/ContentState';
import DetailHeader from '@/shared/ui/detail-header/DetailHeader';
import QueryState from '@/shared/ui/query-state/QueryState';

import PropertyPhotosSkeleton from './PropertyPhotosSkeleton';

const backToList = <Link to={HOME_PATH}>홈으로 돌아가기</Link>;
const describeError = describePropertyLoadError('사진 목록을 불러오지 못했어요.');

const PropertyPhotosPage = () => {
  const propertyId = parsePropertyRouteId(useParams().propertyId);
  if (propertyId === null) return <ContentState title="올바른 매물 주소가 아니에요.">{backToList}</ContentState>;
  return <ResolvedPropertyPhotosPage propertyId={propertyId} />;
};

const ResolvedPropertyPhotosPage = ({ propertyId }: { propertyId: number }) => {
  const property = usePropertyDetail(propertyId);
  // 상세에서 들어왔으면 이전 기록(상세)으로 돌아가 상세가 들어온 곳을 잃지 않는다. 주소로 바로 열었으면 상세로 바꿔 이동한다.
  const goBack = useReturnNavigation({
    cameFromTarget: cameFromPropertyDetail(useLocation().state),
    fallback: propertyDetailPath(propertyId),
  });

  return (
    <QueryState
      query={property}
      loadingTitle="사진 정보를 불러오는 중이에요."
      skeleton={<PropertyPhotosSkeleton />}
      describeError={describeError}
      errorAction={backToList}
    >
      {(detail) => (
        <main className={styles.page}>
          <DetailHeader title={`${detail.name} · 사진`} onBack={goBack} backLabel="매물 상세로 돌아가기" />
          <div className={styles.container}>
            <h1 className="sr-only">{detail.name} 사진 관리</h1>
            <PropertyPhotoManager propertyId={propertyId} />
          </div>
        </main>
      )}
    </QueryState>
  );
};

const styles = {
  page: css`
    label: PropertyPhotosPage-page;
    min-height: 100%;
    padding: 0 1rem 1.5rem;
    background: var(--color-canvas);
  `,

  container: css`
    label: PropertyPhotosPage-container;
    padding: 0.45rem 0 2rem;
  `,
};

export default PropertyPhotosPage;
