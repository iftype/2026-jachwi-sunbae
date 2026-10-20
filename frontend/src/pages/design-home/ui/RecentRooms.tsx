import { usePropertyList } from '@/features/property/api/useProperties';
import { formatRentSummary } from '@/features/property/lib/propertyFormat';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import { Button } from '@/shared/ui/button/Button';
import HorizontalRail from '@/shared/ui/horizontal-rail/HorizontalRail';
import Icon from '@/shared/ui/icon/Icon';
import RailCard from '@/shared/ui/rail-card/RailCard';

import styles from './RecentRooms.module.css';

const RECENT_ROOM_LIMIT = 5;

type RecentRoomsProps = {
  /** 켜면 좁은 오른쪽 열에 맞게 카드를 두 장 남짓 보이도록 둔다(데스크탑). */
  inSideColumn?: boolean;
};

const RecentRooms = ({ inSideColumn = false }: RecentRoomsProps) => {
  const properties = usePropertyList();
  const rooms = properties.data?.pages.flatMap((page) => page.content).slice(0, RECENT_ROOM_LIMIT) ?? [];
  return (
    <section className={styles.section} data-side-column={inSideColumn || undefined} aria-labelledby="recent-heading">
      <div className={styles.sectionHeading}>
        <h2 id="recent-heading">최근 기록한 방</h2>
      </div>
      {properties.isPending ? (
        <p role="status">기록을 불러오는 중이에요.</p>
      ) : properties.isError ? (
        <div className={styles.loadError} role="alert">
          {/* 불러오기 실패 이미지는 준비되면 이 자리에 넣는다. */}
          <span className={styles.loadErrorImage} aria-hidden="true" />
          <p>기록을 불러오지 못했어요.</p>
          <Button variant="secondary" isLoading={properties.isFetching} onClick={() => void properties.refetch()}>
            다시 시도
          </Button>
        </div>
      ) : rooms.length === 0 ? (
        <p>아직 기록한 방이 없어요.</p>
      ) : (
        <HorizontalRail className={styles.rooms} aria-label="최근 기록한 방 목록">
          {rooms.map((property) => (
            <RailCard
              // 데스크탑은 같은 주소에서 본 방 기록 화면이 이 매물을 고른 채로 열린다.
              to={`/properties/${property.propertyId}`}
              state={{ returnTo: '/' }}
              key={property.propertyId}
              className={styles.roomCard}
            >
              {property.representativePhoto ? (
                <AuthenticatedPhoto
                  propertyId={property.propertyId}
                  photoId={property.representativePhoto.photoId}
                  contentUrl={property.representativePhoto.contentUrl}
                  alt={`${property.name} 대표 사진`}
                  className={styles.roomPicture}
                  errorMode="retry-only"
                />
              ) : (
                <span className={`${styles.roomPicture} ${styles.photoFallback}`} aria-label="대표 사진 없음">
                  <Icon name="image" size={18} />
                </span>
              )}
              <div className={styles.roomInfo}>
                <strong>{property.name}</strong>
                <span className={styles.rent}>
                  {property.monthlyRentAmount > 0 ? '월세 ' : ''}
                  {formatRentSummary(property.depositAmount, property.monthlyRentAmount)}
                </span>
                <p>{property.location.address ?? '주소 미등록'}</p>
              </div>
            </RailCard>
          ))}
        </HorizontalRail>
      )}
    </section>
  );
};
export default RecentRooms;
