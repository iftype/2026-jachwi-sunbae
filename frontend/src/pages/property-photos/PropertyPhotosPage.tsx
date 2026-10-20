import { Link, useParams } from 'react-router-dom';

import { describePropertyLoadError } from '@/features/property/api/propertyErrorMessages';
import { usePropertyDetail } from '@/features/property/api/useProperties';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import PropertyPhotoManager from '@/features/property/ui/property-photo-manager/PropertyPhotoManager';
import ContentState from '@/shared/ui/content-state/ContentState';
import QueryState from '@/shared/ui/query-state/QueryState';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import styles from './PropertyPhotosPage.module.css';

const backToList = <Link to="/">홈으로 돌아가기</Link>;
const describeError = describePropertyLoadError('사진 목록을 불러오지 못했어요.');

const PropertyPhotosPage = () => {
  const propertyId = parsePositiveId(useParams().propertyId);
  if (propertyId === null) return <ContentState title="올바른 매물 주소가 아니에요.">{backToList}</ContentState>;
  return <ResolvedPropertyPhotosPage propertyId={propertyId} />;
};

const ResolvedPropertyPhotosPage = ({ propertyId }: { propertyId: number }) => {
  const property = usePropertyDetail(propertyId);

  return (
    <QueryState
      query={property}
      loadingTitle="사진 정보를 불러오는 중이에요."
      describeError={describeError}
      errorAction={backToList}
    >
      {(detail) => (
        <main className={styles.page}>
          <TopNavigation
            title={`${detail.name} · 사진`}
            backTo={`/properties/${propertyId}`}
            backLabel="매물 상세로 돌아가기"
          />
          <div className={styles.container}>
            <h1 className="sr-only">{detail.name} 사진 관리</h1>
            <PropertyPhotoManager propertyId={propertyId} />
          </div>
        </main>
      )}
    </QueryState>
  );
};

export default PropertyPhotosPage;
