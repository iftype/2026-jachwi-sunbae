import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '@/features/auth/api/apiClient';
import { describePropertyLoadError } from '@/features/property/api/propertyErrorMessages';
import { usePropertyDetail } from '@/features/property/api/useProperties';
import { useUpdateProperty } from '@/features/property/api/usePropertyMutations';
import { formatAmountForInput } from '@/features/property/lib/propertyForm';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';
import type { PropertyDetail } from '@/features/property/model/Property';
import PropertyForm from '@/features/property/ui/property-form/PropertyForm';
import ContentState from '@/shared/ui/content-state/ContentState';
import QueryState from '@/shared/ui/query-state/QueryState';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import styles from './EditPropertyPage.module.css';

const backToList = <Link to="/">홈으로 돌아가기</Link>;
const describeError = describePropertyLoadError('매물 정보를 불러오지 못했어요.');

const EditPropertyPage = () => {
  const propertyId = parsePositiveId(useParams().propertyId);
  if (propertyId === null) return <ContentState title="올바른 매물 주소가 아니에요.">{backToList}</ContentState>;
  return <ResolvedEditPropertyPage propertyId={propertyId} />;
};

const ResolvedEditPropertyPage = ({ propertyId }: { propertyId: number }) => {
  const property = usePropertyDetail(propertyId);

  return (
    <QueryState
      query={property}
      loadingTitle="매물 정보를 불러오는 중이에요."
      describeError={describeError}
      errorAction={backToList}
    >
      {(initial) => <EditPropertyView propertyId={propertyId} initial={initial} />}
    </QueryState>
  );
};

type EditPropertyViewProps = { propertyId: number; initial: PropertyDetail };

const EditPropertyView = ({ propertyId, initial }: EditPropertyViewProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const updateMutation = useUpdateProperty(propertyId);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const mutationError = updateMutation.error instanceof ApiError ? updateMutation.error : null;
  const selectedLocation =
    (location.state as {
      address?: string;
      latitude?: number;
      longitude?: number;
    } | null) ?? {};

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <TopNavigation
          title="매물 정보 수정"
          backTo={`/properties/${propertyId}`}
          backLabel="매물 정보 수정 닫기"
          navigationIcon="close"
        />
        <h1 className={styles.heading}>매물 정보를 수정해주세요</h1>
        <PropertyForm
          initialValues={{
            name: initial.name,
            depositAmount: formatAmountForInput(initial.depositAmount),
            monthlyRentAmount: formatAmountForInput(initial.monthlyRentAmount),
            discoverySource: initial.discoverySource.value,
            address: selectedLocation.address ?? initial.location.address ?? '',
            latitude: selectedLocation.latitude ?? initial.location.latitude,
            longitude: selectedLocation.longitude ?? initial.location.longitude,
          }}
          submitLabel="변경사항 저장"
          isSubmitting={updateMutation.isPending}
          mutationError={mutationError}
          formNotice={formNotice}
          variant="detail"
          onSelectLocation={() =>
            navigate('/map/select-location', {
              state: {
                returnTo: `/properties/${propertyId}/edit`,
                initialLocation:
                  initial.location.latitude === null || initial.location.longitude === null
                    ? undefined
                    : {
                        address: initial.location.address,
                        roadAddress: null,
                        jibunAddress: null,
                        latitude: initial.location.latitude,
                        longitude: initial.location.longitude,
                      },
              },
            })
          }
          onSubmit={({ name, depositAmount, monthlyRentAmount, discoverySource, address, latitude, longitude }) => {
            setFormNotice(null);
            void updateMutation
              .mutateAsync({
                current: initial,
                changes: { name, depositAmount, monthlyRentAmount, discoverySource, address, latitude, longitude },
              })
              .then(() => navigate(`/properties/${propertyId}`, { replace: true }))
              .catch(() => undefined);
          }}
        />
      </div>
    </main>
  );
};

export default EditPropertyPage;
