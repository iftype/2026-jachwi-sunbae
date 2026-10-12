import { Link } from 'react-router-dom';

import type { PropertyPhotoPreview } from '@/features/property/model/Property';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import Icon from '@/shared/ui/icon/Icon';

import styles from './PropertyHeroPhoto.module.css';

type PropertyHeroPhotoProps = {
  propertyId: number;
  propertyName: string;
  photos: PropertyPhotoPreview[];
  backTo: string;
  backState?: unknown;
  onOpen: () => void;
};

const PropertyHeroPhoto = ({ propertyId, propertyName, photos, backTo, backState, onOpen }: PropertyHeroPhotoProps) => (
  <section className={styles.section} aria-label="대표 사진">
    {photos.length > 0 ? (
      <button
        type="button"
        className={styles.button}
        aria-label={`${propertyName} 대표 사진 크게 보기`}
        onClick={onOpen}
      >
        <AuthenticatedPhoto
          propertyId={propertyId}
          photoId={photos[0].photoId}
          contentUrl={photos[0].contentUrl}
          alt={`${propertyName} 대표 사진`}
          className={styles.photo}
        />
      </button>
    ) : (
      <Link className={`${styles.button} ${styles.emptyButton}`} to={`/properties/${propertyId}/photos`}>
        <span className={styles.addLabel}>
          <Icon name="plus" size={16} />
          사진 추가
        </span>
      </Link>
    )}
    <Link
      className={styles.backButton}
      to={backTo}
      state={backState}
      aria-label={backTo === '/map' ? '매물 지도로 돌아가기' : '매물 목록으로 돌아가기'}
    >
      <Icon name="chevron-left" size={24} />
    </Link>
  </section>
);

export default PropertyHeroPhoto;
