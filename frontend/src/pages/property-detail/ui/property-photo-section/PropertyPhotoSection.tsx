import { css } from '@emotion/css';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { FROM_PROPERTY_DETAIL_STATE } from '@/features/property/lib/propertyNavigation';
import type { PropertyDetail } from '@/features/property/model/Property';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import { propertyPhotosPath } from '@/shared/lib/navigation/appPaths';
import DetailSection from '@/shared/ui/detail-section/DetailSection';
import Icon from '@/shared/ui/icon/Icon';

type PropertyPhotoSectionProps = {
  propertyId: number;
  propertyName: string;
  photoPreview: PropertyDetail['photoPreview'];
  onSelect: (index: number, trigger: HTMLButtonElement) => void;
  /** 주면 사진 관리를 눌러도 사진 화면으로 넘어가지 않고 이 함수를 부른다(데스크탑 옆 칸은 그 칸 안에서 사진을 관리한다). */
  onManage?: () => void;
};

const PropertyPhotoSection = ({
  propertyId,
  propertyName,
  photoPreview,
  onSelect,
  onManage,
}: PropertyPhotoSectionProps) => {
  const manage = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onManage === undefined) return;
    event.preventDefault();
    onManage();
  };
  return (
    <DetailSection
      title="사진"
      meta={<span>{photoPreview.totalCount}/30</span>}
      action={
        <Link to={propertyPhotosPath(propertyId)} state={FROM_PROPERTY_DETAIL_STATE} onClick={manage}>
          <Icon name="plus" size={16} /> 사진 관리
        </Link>
      }
    >
      {photoPreview.photos.length > 0 ? (
        <div className={styles.grid}>
          {photoPreview.photos.slice(0, 3).map((photo, index) => {
            const isMorePreview = index === 2 && photoPreview.totalCount > 3;
            return (
              <button
                type="button"
                className={styles.thumbnailButton}
                key={photo.photoId}
                aria-label={`${propertyName} 사진 ${index + 1} 크게 보기`}
                onClick={(event: MouseEvent<HTMLButtonElement>) => onSelect(index, event.currentTarget)}
              >
                <AuthenticatedPhoto
                  propertyId={propertyId}
                  photoId={photo.photoId}
                  kind="thumbnail"
                  contentUrl={photo.thumbnailUrl}
                  alt=""
                  className={styles.thumbnail}
                />
                {isMorePreview && <span className={styles.moreOverlay}>+{photoPreview.totalCount - 2}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <Link
          className={styles.emptyLink}
          to={propertyPhotosPath(propertyId)}
          state={FROM_PROPERTY_DETAIL_STATE}
          onClick={manage}
        >
          사진을 추가해 주세요.
        </Link>
      )}
    </DetailSection>
  );
};

const styles = {
  grid: css`
    label: PropertyPhotoSection-grid;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem;
  `,

  thumbnailButton: css`
    label: PropertyPhotoSection-thumbnailButton;
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--color-surface-disabled);
    cursor: pointer;
  `,

  thumbnail: css`
    label: PropertyPhotoSection-thumbnail;
    width: 100%;
    height: 100%;
    padding: 0;
    border-radius: 0;
    object-fit: cover;
  `,

  moreOverlay: css`
    label: PropertyPhotoSection-moreOverlay;
    position: absolute;
    inset: 0;
    display: grid;
    background: var(--color-overlay);
    color: white;
    font-size: 0.75rem;
    font-weight: 800;
    place-items: center;
  `,

  emptyLink: css`
    label: PropertyPhotoSection-emptyLink;
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    font-size: 0.72rem;
    text-decoration: none;
  `,
};

export default PropertyPhotoSection;
