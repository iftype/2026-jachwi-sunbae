import { Link, useNavigate, useParams } from 'react-router-dom';

import { getPropertyErrorMessage } from '@/features/property/api/propertyErrorMessages';
import { usePropertyDetail } from '@/features/property/api/useProperties';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import ContentState from '@/shared/ui/content-state/ContentState';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import PropertyAdditionalInfoForm from './ui/property-additional-info-form/PropertyAdditionalInfoForm';

import styles from './PropertyMemoPage.module.css';

const PropertyMemoPage = () => {
  const propertyId = parsePositiveId(useParams().propertyId);
  if (propertyId === null) {
    return (
      <ContentState title="올바른 매물 주소가 아니에요.">
        <Link to="/">홈으로 돌아가기</Link>
      </ContentState>
    );
  }
  return <ResolvedPropertyMemoPage propertyId={propertyId} />;
};

const ResolvedPropertyMemoPage = ({ propertyId }: { propertyId: number }) => {
  const navigate = useNavigate();
  const property = usePropertyDetail(propertyId);

  if (property.isError) {
    return (
      <ContentState
        tone="error"
        title="부가 정보를 불러오지 못했어요."
        description={getPropertyErrorMessage(property.error)}
        onRetry={() => void property.refetch()}
      />
    );
  }
  if (property.isPending) {
    return <ContentState loading title="부가 정보를 불러오는 중이에요." />;
  }

  return (
    <main className={styles.page}>
      <TopNavigation
        title={`${property.data.name} 부가 정보`}
        backTo={`/properties/${propertyId}`}
        backLabel="매물 상세로 돌아가기"
      />
      <PropertyAdditionalInfoForm
        property={property.data}
        onSaved={() => navigate(`/properties/${propertyId}`, { replace: true })}
      />
    </main>
  );
};

export default PropertyMemoPage;
