import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import type { PropertyPhotoPreview } from '@/features/property/model/Property';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import PropertyPlaceholderPhoto from '@/features/property/ui/property-placeholder-photo/PropertyPlaceholderPhoto';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

type PropertyHeroPhotoProps = {
  propertyId: number;
  propertyName: string;
  photos: PropertyPhotoPreview[];
  backTo: string;
  backState?: unknown;
  showBackButton?: boolean;
  onOpen: () => void;
};

const PropertyHeroPhoto = ({
  propertyId,
  propertyName,
  photos,
  backTo,
  backState,
  showBackButton = true,
  onOpen,
}: PropertyHeroPhotoProps) => (
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
      // 사진이 없을 때는 기본 이미지만 보인다. 사진 추가 버튼은 일단 두지 않는다.
      <div className={`${styles.button} ${styles.emptyButton}`}>
        <PropertyPlaceholderPhoto className={styles.photo} alt="기본 매물 이미지" />
      </div>
    )}
    {showBackButton && (
      <Link
        className={styles.backButton}
        to={backTo}
        state={backState}
        aria-label={backTo === RECORDS_PATH ? '기록 화면으로 돌아가기' : '홈으로 돌아가기'}
      >
        <Icon name="chevron-left" size={24} />
      </Link>
    )}
  </section>
);

const styles = {
  section: css`
    label: PropertyHeroPhoto-section;
    position: relative;
    width: calc(100% + 2rem);
    margin-left: -1rem;
  `,

  button: css`
    label: PropertyHeroPhoto-button;
    display: block;
    width: 100%;
    height: calc(11rem + var(--app-bar-height));
    min-height: 0;
    max-height: calc(11rem + var(--app-bar-height));
    overflow: hidden;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: var(--color-surface-muted);
    color: inherit;
    cursor: pointer;
    text-decoration: none;
  `,

  emptyButton: css`
    label: PropertyHeroPhoto-emptyButton;
    position: relative;
  `,

  addLabel: css`
    label: PropertyHeroPhoto-addLabel;
    position: absolute;
    right: 1rem;
    bottom: 2.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.6rem 0.8rem;
    border-radius: 999px;
    background: rgb(33 33 36 / 82%);
    color: white;
    font-size: 0.72rem;
    font-weight: 750;
  `,

  photo: css`
    label: PropertyHeroPhoto-photo;
    display: block;
    width: 100%;
    height: 100%;
    aspect-ratio: auto;
    border-radius: 0;
    object-fit: cover;
  `,

  backButton: css`
    label: PropertyHeroPhoto-backButton;
    position: absolute;
    z-index: 2;
    top: 0.75rem;
    left: 0.75rem;
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    text-decoration: none;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
};

export default PropertyHeroPhoto;
