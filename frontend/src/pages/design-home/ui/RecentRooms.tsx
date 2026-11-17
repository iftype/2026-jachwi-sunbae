import { css, cx } from '@emotion/css';
import { Link } from 'react-router-dom';

import { usePropertyList } from '@/features/property/api/useProperties';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import PropertyAddress from '@/features/property/ui/property-address/PropertyAddress';
import PropertyPlaceholderPhoto from '@/features/property/ui/property-placeholder-photo/PropertyPlaceholderPhoto';
import PropertyPrice from '@/features/property/ui/property-price/PropertyPrice';
import { HOME_PATH, propertyDetailPath, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import { Button } from '@/shared/ui/button/Button';
import DelayedFallback from '@/shared/ui/delayed-fallback/DelayedFallback';
import HorizontalRail from '@/shared/ui/horizontal-rail/HorizontalRail';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';
import RailCard from '@/shared/ui/rail-card/RailCard';
import StateIllustration from '@/shared/ui/state-illustration/StateIllustration';

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
      {/*
        홈의 다른 요소가 남아 있는 칸이라, 빠른 응답에는 로딩 문구 없이 바로 목록을 보여 주고 오래 걸릴 때만 알린다.
        몇 개가 올지 모르는 목록이라 카드 뼈대는 두지 않고, 데이터 전에도 문구 한 줄 높이를 잡아 아래가 덜 밀리게 한다.
      */}
      <div className={styles.body}>
        <DelayedFallback
          isPending={properties.isPending}
          fallback={<ProgressCircle size={24} label="기록을 불러오는 중이에요." />}
        >
          {() =>
            properties.isError ? (
              <div className={styles.loadError} role="alert">
                <StateIllustration name="error" size={7} />
                <p>기록을 불러오지 못했어요.</p>
                <Button variant="secondary" isLoading={properties.isFetching} onClick={() => void properties.refetch()}>
                  다시 시도
                </Button>
              </div>
            ) : rooms.length === 0 ? (
              <Link className={styles.empty} to={RECORDS_PATH}>
                <span>아직 기록한 방이 없어요.</span>
                <strong>+ 매물 추가하기</strong>
              </Link>
            ) : (
              <HorizontalRail className={styles.rooms} aria-label="최근 기록한 방 목록">
                {rooms.map((property) => (
                  <RailCard
                    // 데스크탑은 같은 주소에서 본 방 기록 화면이 이 매물을 고른 채로 열린다.
                    to={propertyDetailPath(property.propertyId)}
                    state={{ returnTo: HOME_PATH }}
                    key={property.propertyId}
                    className={styles.roomCard}
                  >
                    {property.representativePhoto ? (
                      <AuthenticatedPhoto
                        propertyId={property.propertyId}
                        photoId={property.representativePhoto.photoId}
                        kind="thumbnail"
                        contentUrl={property.representativePhoto.thumbnailUrl}
                        alt={`${property.name} 대표 사진`}
                        className={styles.roomPicture}
                        errorMode="retry-only"
                      />
                    ) : (
                      <span className={`${styles.roomPicture} ${styles.photoFallback}`} aria-label="대표 사진 없음">
                        <PropertyPlaceholderPhoto className={styles.fallbackImage} />
                      </span>
                    )}
                    <div className={styles.roomInfo}>
                      <strong>{property.name}</strong>
                      <PropertyPrice
                        className={styles.rent}
                        depositAmount={property.depositAmount}
                        monthlyRentAmount={property.monthlyRentAmount}
                        variant="summary"
                      />
                      <p>
                        <PropertyAddress address={property.location.address} />
                      </p>
                    </div>
                  </RailCard>
                ))}
              </HorizontalRail>
            )
          }
        </DelayedFallback>
      </div>
    </section>
  );
};

const styles = {
  // 다른 요소의 선택자에서 `.RecentRooms-section`로 가리킨다.
  section: cx(
    css`
      label: RecentRooms-section;
      margin-top: 2.2rem;
    `,
    'RecentRooms-section',
  ),

  sectionHeading: css`
    label: RecentRooms-sectionHeading;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.9rem;

    & h2 {
      font-size: 1rem;
      margin: 0;
      letter-spacing: -0.035em;
    }
  `,

  /*
   * 데이터 전 빈자리도 안내 문구, 빈 기록 문구 한 줄만큼은 차지한다. 문구(줄 높이 약 1.28rem)의 위 여백이
   * 제목 아래 여백보다 0.1rem 커서 그만큼을 더한다.
   */
  body: css`
    label: RecentRooms-body;
    min-height: 1.38rem;
  `,

  /* 불러오기에 실패하면 이미지·안내·다시 시도 버튼을 가운데에 세로로 둔다. */
  loadError: css`
    label: RecentRooms-loadError;
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    padding: 1.25rem 0 0.5rem;
    text-align: center;

    & p {
      margin: 0;
      color: var(--color-muted);
      font-size: 0.85rem;
    }
  `,

  /* 기록한 방이 없으면 카드 한 장 높이의 점선 칸 가운데에 안내와 추가 문구를 두고, 칸 전체가 방 기록 화면으로 가는 링크다. */
  empty: css`
    label: RecentRooms-empty;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.35rem;
    min-height: 9rem;
    padding: 1rem;
    border: 1.5px dashed var(--color-border-strong);
    border-radius: var(--radius-tile);
    color: var(--color-muted);
    font-size: 0.85rem;
    text-align: center;
    text-decoration: none;

    & strong {
      color: var(--color-brand-blue-ink);
      font-size: 0.9rem;
    }

    @media (hover: hover) {
      &:hover {
        background: var(--color-card-surface);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,

  rooms: css`
    label: RecentRooms-rooms;
    /* 홈 본문 좌우 패딩만큼 화면 끝까지 카드를 흘려 다음 카드가 있다는 걸 보여준다. */
    --horizontal-rail-bleed: 1.25rem;
    --horizontal-rail-gap: 0.7rem;
    padding-bottom: 0.25rem;

    @media (max-width: 360px) {
      --horizontal-rail-bleed: 1rem;
    }

    /* 데스크탑 오른쪽 열처럼 좁은 칸에서는 가장자리 여백 없이 카드를 두 장 남짓 보이게 한다. */
    .RecentRooms-section[data-side-column='true'] & {
      --horizontal-rail-bleed: 0px;
      --horizontal-rail-gap: 0.75rem;
    }
  `,

  /* 동작은 공통 RailCard가 맡고, 여기서는 사진 위·정보 아래로 된 카드 모양만 정한다. */
  roomCard: css`
    label: RecentRooms-roomCard;
    flex: 0 0 42%;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-tile);
    background: var(--color-surface);

    @media (max-width: 360px) {
      flex-basis: 52%;
    }

    /* 넓은 화면에서도 카드는 모바일 크기로 두고 한 줄에 더 많이 보여준다. */
    @media (min-width: 768px) {
      flex-basis: 11rem;
    }

    .RecentRooms-section[data-side-column='true'] & {
      flex-basis: calc((100% - var(--horizontal-rail-gap)) / 2.2);
    }
  `,

  roomPicture: css`
    label: RecentRooms-roomPicture;
    display: grid;
    place-items: center;
    width: 100%;
    height: 7rem;
    position: relative;
    overflow: hidden;
    flex: 0 0 auto;
    border-radius: 0.7rem;
    object-fit: cover;
    background: var(--color-card-surface);
    color: var(--color-placeholder);

    &.authenticated-photo {
      box-sizing: border-box;
      aspect-ratio: auto;
      gap: 0.2rem;
      padding: 0.3rem;
      font-size: 0.58rem;
      line-height: 1.2;
    }

    &.authenticated-photo .inline-button {
      min-height: 1.5rem;
      padding: 0.1rem 0.25rem;
      font-size: 0.58rem;
      text-decoration: none;
    }
  `,

  /* 사진이 없는 방은 목록, 상세와 같은 기본 이미지(집 그림)로 채운다. */
  fallbackImage: css`
    label: RecentRooms-fallbackImage;
    /* 칸 높이(7rem)를 꽉 채우고 넘치는 좌우는 잘라, 위아래에 회색 띠가 남지 않게 한다. */
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,

  photoFallback: css`
    label: RecentRooms-photoFallback;
    align-content: center;
    justify-items: center;
  `,

  // 다른 요소의 선택자에서 `.RecentRooms-roomInfo`로 가리킨다.
  roomInfo: cx(
    css`
      label: RecentRooms-roomInfo;
      display: grid;
      min-width: 0;
      align-content: start;
      gap: 0.25rem;
      padding: 0.8rem 0.7rem;

      & > strong {
        overflow: hidden;
        color: var(--color-ink);
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: -0.04em;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      & p {
        overflow: hidden;
        margin: 0;
        color: var(--color-muted);
        font-size: 0.68rem;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
    'RecentRooms-roomInfo',
  ),

  rent: css`
    label: RecentRooms-rent;

    .RecentRooms-roomInfo > & {
      overflow: hidden;
      color: var(--color-price);
      font-size: 0.78rem;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
};

export default RecentRooms;
