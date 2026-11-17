import { css } from '@emotion/css';
import { useRef, useState } from 'react';

import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';

import { getPropertyErrorMessage } from '../../api/propertyErrorMessages';
import { useRemovePropertyPhoto, useSetRepresentativePropertyPhoto } from '../../api/usePropertyMutations';
import type { PropertyPhoto } from '../../model/Property';
import AuthenticatedPhoto from '../authenticated-photo/AuthenticatedPhoto';

import * as dialogStyles from '@/shared/ui/confirm-dialog/ConfirmDialog.styles';

type PropertyPhotoCardProps = {
  propertyId: number;
  photo: PropertyPhoto;
  position: number;
};

const PropertyPhotoCard = ({ propertyId, photo, position }: PropertyPhotoCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const removeMutation = useRemovePropertyPhoto(propertyId);
  const representativeMutation = useSetRepresentativePropertyPhoto(propertyId);
  const accessibleName = `업로드 순 ${position}번째 사진`;

  const remove = async () => {
    try {
      await removeMutation.mutateAsync(photo.photoId);
      trackPostHogEvent('property_photo_deleted');
      setIsDialogOpen(false);
      window.setTimeout(() => document.getElementById('photo-gallery-heading')?.focus(), 0);
    } catch {
      trackPostHogEvent('property_photo_delete_failed');
      // Dialog remains open so the user can retry without optimistic removal.
    }
  };

  return (
    <li className={styles.item}>
      <AuthenticatedPhoto
        propertyId={propertyId}
        photoId={photo.photoId}
        kind="thumbnail"
        contentUrl={photo.thumbnailUrl}
        alt={accessibleName}
      />
      <button
        className={`${styles.representativeButton} ${photo.representative === true ? styles.isRepresentative : ''}`}
        type="button"
        aria-label={
          photo.representative === true ? `${accessibleName} 대표 사진` : `${accessibleName}을 대표 사진으로 지정`
        }
        aria-pressed={photo.representative === true}
        disabled={photo.representative === true || representativeMutation.isPending}
        onClick={() => representativeMutation.mutate(photo.photoId)}
      >
        <span aria-hidden="true">{photo.representative === true ? '★' : '☆'}</span>
        대표
      </button>
      <button
        ref={deleteButtonRef}
        className={styles.deleteButton}
        type="button"
        aria-label={`${accessibleName} 삭제`}
        onClick={() => setIsDialogOpen(true)}
      >
        삭제
      </button>
      {representativeMutation.isError && (
        <p className={styles.representativeError} role="alert">
          대표 사진 지정 실패
        </p>
      )}
      <ConfirmDialog
        isOpen={isDialogOpen}
        title="이 사진을 삭제할까요?"
        description={<p>{accessibleName}을 삭제합니다. 다른 사진과 매물은 그대로 유지됩니다.</p>}
        confirmLabel="사진 삭제"
        isConfirming={removeMutation.isPending}
        returnFocusRef={deleteButtonRef}
        onCancel={() => setIsDialogOpen(false)}
        onConfirm={() => void remove()}
      >
        {isDialogOpen && (
          <AuthenticatedPhoto
            propertyId={propertyId}
            photoId={photo.photoId}
            kind="thumbnail"
            contentUrl={photo.thumbnailUrl}
            alt={`삭제할 ${accessibleName}`}
            className={dialogStyles.photo}
          />
        )}
        {removeMutation.isError && (
          <p className="form-error" role="alert">
            {getPropertyErrorMessage(removeMutation.error)} 사진은 화면에서 제거하지 않았어요.
          </p>
        )}
      </ConfirmDialog>
    </li>
  );
};

const styles = {
  item: css`
    label: PropertyPhotoCard-item;
    position: relative;
    min-width: 0;

    & > .authenticated-photo,
    & > .authenticated-photo__image {
      aspect-ratio: 1;
    }
  `,

  deleteButton: css`
    label: PropertyPhotoCard-deleteButton;
    position: absolute;
    z-index: 2;
    top: 0.35rem;
    right: 0.35rem;
    display: grid;
    width: 1.65rem;
    min-width: 1.65rem;
    min-height: 1.65rem;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--color-overlay-strong);
    color: var(--color-on-primary);
    font-size: 0;
    cursor: pointer;
    place-items: center;

    &::before,
    &::after {
      position: absolute;
      width: 0.7rem;
      height: 1px;
      background: currentColor;
      content: '';
    }

    &::before {
      transform: rotate(45deg);
    }

    &::after {
      transform: rotate(-45deg);
    }
  `,

  representativeButton: css`
    label: PropertyPhotoCard-representativeButton;
    position: absolute;
    z-index: 2;
    top: 0.35rem;
    left: 0.35rem;
    display: inline-flex;
    min-height: 1.65rem;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.3rem;
    border: 0;
    border-radius: 999px;
    background: var(--color-overlay-strong);
    color: var(--color-on-primary);
    font: inherit;
    font-size: 0.52rem;
    font-weight: 800;
    cursor: pointer;

    &:disabled {
      cursor: default;
    }
  `,

  isRepresentative: css`
    label: PropertyPhotoCard-isRepresentative;
    background: var(--color-primary-dark);
  `,

  representativeError: css`
    label: PropertyPhotoCard-representativeError;
    position: absolute;
    right: 0.2rem;
    bottom: 0.2rem;
    left: 0.2rem;
    z-index: 2;
    margin: 0;
    padding: 0.18rem;
    border-radius: 0.25rem;
    background: var(--color-error-surface);
    color: var(--color-error);
    font-size: 0.52rem;
    font-weight: 700;
    text-align: center;
  `,
};

export default PropertyPhotoCard;
