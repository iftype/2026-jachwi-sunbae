import { css } from '@emotion/css';

import { usePropertyDetail } from '@/features/property/api/useProperties';
import { formatDateTime } from '@/features/property/lib/propertyFormat';
import type { PropertySummary } from '@/features/property/model/Property';
import { roomOptionLabels, utilityOptionLabels } from '@/features/property/model/propertyOptions';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import PropertyPlaceholderPhoto from '@/features/property/ui/property-placeholder-photo/PropertyPlaceholderPhoto';
import PropertyPrice from '@/features/property/ui/property-price/PropertyPrice';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';

const ComparePropertyPreview = ({ property }: { property: PropertySummary }) => {
  const { data, isPending, isError } = usePropertyDetail(property.propertyId);
  const photo = data?.photoPreview.photos[0] ?? property.representativePhoto;
  const details = data && [
    [
      '관리비',
      data.maintenanceFeeAmount === null ? '입력 전' : `${data.maintenanceFeeAmount.toLocaleString('ko-KR')}원`,
    ],
    ['관리비에 포함된 공과금', utilityOptionLabels(data.utilityOptions) || '입력 전'],
    ['입주 가능일', data.availableMoveInDate ?? '입력 전'],
    ['방문 일정', data.visitScheduledAt ? formatDateTime(data.visitScheduledAt) : '입력 전'],
    ['방 옵션', roomOptionLabels(data.roomOptions) || '입력 전'],
  ];

  return (
    <aside id="compare-property-preview" className={styles.preview} aria-label="매물 미리 보기">
      <div className={styles.photo}>
        {photo ? (
          <AuthenticatedPhoto
            propertyId={property.propertyId}
            photoId={photo.photoId}
            kind="thumbnail"
            contentUrl={photo.thumbnailUrl}
            alt={`${property.name} 대표 사진`}
          />
        ) : (
          <PropertyPlaceholderPhoto />
        )}
      </div>
      <h2>{data?.name ?? property.name}</h2>
      <PropertyPrice
        depositAmount={data?.depositAmount ?? property.depositAmount}
        monthlyRentAmount={data?.monthlyRentAmount ?? property.monthlyRentAmount}
        variant="labeled"
      />
      <dl>
        <div>
          <dt>주소</dt>
          <dd>{(data ?? property).location.address || '입력 전'}</dd>
        </div>
        <div>
          <dt>발견 경로</dt>
          <dd>{(data ?? property).discoverySource.value || '입력 전'}</dd>
        </div>
        {details?.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {isPending && <p role="status">상세 정보를 불러오고 있어요.</p>}
      {isError && <InlineNotice tone="error">상세 정보를 불러오지 못했어요.</InlineNotice>}
    </aside>
  );
};

const styles = {
  preview: css`
    display: grid;
    gap: 0.65rem;
    padding: 0.85rem;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    overflow-wrap: anywhere;

    & h2,
    & dl,
    & dd,
    & p {
      margin: 0;
    }
    & h2 {
      font-size: 1.05rem;
    }
    & dl {
      display: grid;
      gap: 0.35rem;
    }
    & dl > div {
      display: grid;
      grid-template-columns: minmax(4rem, 40%) minmax(0, 1fr);
      gap: 0.5rem;
    }
    & dt,
    & p {
      color: var(--color-muted);
      font-size: 0.75rem;
    }
    & dd {
      font-size: 0.8rem;
    }
  `,
  photo: css`
    display: grid;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: var(--radius-sm);

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
};

export default ComparePropertyPreview;
