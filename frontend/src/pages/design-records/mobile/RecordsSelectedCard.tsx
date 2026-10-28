import { Link } from 'react-router-dom';

import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

import type { RecordsState } from '../hooks/useRecords';

import styles from './RecordsSelectedCard.module.css';

type Props = {
  record: NonNullable<RecordsState['selected']>;
  onClose: () => void;
};

/** 휴대폰 지도에서 고른 방의 요약 카드. 카드를 누르면 상세 화면으로 간다. */
const RecordsSelectedCard = ({ record, onClose }: Props) => (
  <article className={styles.selectedCard}>
    <Link className={styles.selectedMain} to={`/properties/${record.id}`} state={{ returnTo: RECORDS_PATH }}>
      {record.representativePhoto ? (
        <AuthenticatedPhoto
          propertyId={Number(record.id)}
          photoId={record.representativePhoto.photoId}
          contentUrl={record.representativePhoto.contentUrl}
          alt={`${record.name} 대표 사진`}
          className={styles.selectedPhoto}
        />
      ) : (
        <span className={styles.selectedPhotoFallback} aria-hidden="true">
          <Icon name="home" size={22} />
        </span>
      )}
      <span className={styles.selectedDetails}>
        <strong>{record.name}</strong>
        <span>{record.price}</span>
      </span>
    </Link>
    <button className={styles.dismissCard} type="button" aria-label="매물 카드 닫기" onClick={onClose}>
      <Icon name="close" size={18} />
    </button>
  </article>
);

export default RecordsSelectedCard;
