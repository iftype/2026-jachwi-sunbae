import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePropertyList } from '@/features/property/api/useProperties';
import type { PropertySummary } from '@/features/property/model/Property';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import PropertyAddress from '@/features/property/ui/property-address/PropertyAddress';
import PropertyPlaceholderPhoto from '@/features/property/ui/property-placeholder-photo/PropertyPlaceholderPhoto';
import PropertyPrice from '@/features/property/ui/property-price/PropertyPrice';
import {
  COMPARE_PATH,
  HOME_PATH,
  NEIGHBORHOODS_PATH,
  propertyDetailPath,
  RECORDS_LIST_PATH,
  RECORDS_MAP_PATH,
} from '@/shared/lib/navigation/appPaths';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import DelayedFallback from '@/shared/ui/delayed-fallback/DelayedFallback';
import Icon from '@/shared/ui/icon/Icon';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';

import neighborhoodImage from '../assets/card-neighborhood.webp';
import notebookImage from '../assets/record-notebook.webp';

type RecentRoomsProps = {
  readonly isDesktop?: boolean;
};

const RoomCard = ({ property, eager }: { readonly property: PropertySummary; readonly eager: boolean }) => {
  const photo = property.representativePhoto;
  const { goodCount, cautionCount, unconfirmedCount } = property.progress;
  const photoRef = useRef<HTMLDivElement>(null);
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const canLoadPhoto = eager || hasEnteredView || typeof IntersectionObserver === 'undefined';

  useEffect(() => {
    const element = photoRef.current;
    if (!photo || !element || canLoadPhoto) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setHasEnteredView(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [canLoadPhoto, photo]);

  return (
    <article className={styles.card}>
      <div ref={photoRef} className={styles.photo}>
        {photo && canLoadPhoto ? (
          <AuthenticatedPhoto
            propertyId={property.propertyId}
            photoId={photo.photoId}
            contentUrl={photo.contentUrl}
            alt={`${property.name} 대표 사진`}
            errorMode="retry-only"
          />
        ) : (
          <PropertyPlaceholderPhoto />
        )}
      </div>
      <Link to={propertyDetailPath(property.propertyId)} state={{ returnTo: HOME_PATH }} className={styles.roomLink}>
        <strong>{property.name}</strong>
        <PropertyPrice
          depositAmount={property.depositAmount}
          monthlyRentAmount={property.monthlyRentAmount}
          variant="labeled"
        />
        <small>
          <PropertyAddress address={property.location.address} />
        </small>
        <span className={styles.checks}>
          <span data-tone="good">괜찮음 {goodCount}</span>
          <span data-tone="caution">주의 {cautionCount}</span>
          <span>미확인 {unconfirmedCount}</span>
        </span>
      </Link>
      <Icon name="chevron-right" size={16} />
    </article>
  );
};

const RecentRooms = ({ isDesktop = false }: RecentRoomsProps) => {
  const properties = usePropertyList();
  const rooms = properties.data?.pages.flatMap((page) => page.content) ?? [];
  const totalRooms = properties.data?.pages[0]?.totalElements ?? 0;
  const hasRooms = rooms.length > 0;
  const canCompare = totalRooms >= 2;
  const heading = isDesktop ? '내가 기록한 방' : '최근 기록한 방';
  const addRoom = (
    <Link className={styles.add} to={RECORDS_MAP_PATH}>
      <span>
        <Icon name="plus" size={15} /> 방 기록하기
      </span>
    </Link>
  );

  return (
    <section className={cx(styles.layout, isDesktop && styles.desktop)} aria-label="자취선배 주요 기능">
      <section className={styles.records} aria-labelledby="recent-heading">
        {hasRooms || properties.isPending || properties.isError ? (
          <>
            <header className={styles.heading}>
              <div>
                <h1 id="recent-heading">{heading}</h1>
                {hasRooms && <p>총 {totalRooms}곳</p>}
              </div>
              {hasRooms && isDesktop && addRoom}
              {!isDesktop && canCompare && (
                <Link to={COMPARE_PATH} className={styles.mobileCompare}>
                  <span>방 비교 PDF 받기</span>
                </Link>
              )}
            </header>
            <div className={styles.body}>
              <DelayedFallback
                isPending={properties.isPending}
                fallback={<ProgressCircle size={24} label="기록을 불러오는 중이에요." />}
              >
                {() =>
                  !hasRooms && properties.isError ? (
                    <div className={styles.loadError} role="alert">
                      <p>기록을 불러오지 못했어요.</p>
                      <Button
                        variant="secondary"
                        isLoading={properties.isFetching}
                        onClick={() => void properties.refetch()}
                      >
                        다시 시도
                      </Button>
                    </div>
                  ) : (
                    <div className={styles.roomList} role="region" aria-label="최근 기록한 방 목록" tabIndex={0}>
                      <ul>
                        {rooms.map((room, index) => (
                          <li key={room.propertyId}>
                            <RoomCard property={room} eager={index < 2} />
                          </li>
                        ))}
                      </ul>
                      {properties.hasNextPage && (
                        <Button
                          variant="text"
                          isLoading={properties.isFetchingNextPage}
                          onClick={() => void properties.fetchNextPage({ cancelRefetch: false })}
                        >
                          {properties.isFetchNextPageError ? '기록 더 불러오기 다시 시도' : '기록 더 불러오기'}
                        </Button>
                      )}
                    </div>
                  )
                }
              </DelayedFallback>
            </div>
            {hasRooms && (
              <div className={styles.actions}>
                <Link to={RECORDS_LIST_PATH}>
                  전체 기록 보기 <Icon name="chevron-right" size={15} />
                </Link>
                {!isDesktop && addRoom}
              </div>
            )}
          </>
        ) : (
          <div className={styles.empty}>
            <div>
              <h1 id="recent-heading">
                보고 온 방,
                <br />
                한곳에 모아 비교해요
              </h1>
              <p>가격과 현장 메모를 남기면 방을 고를 때 다시 볼 수 있어요.</p>
            </div>
            <img src={notebookImage} alt="" />
            <ButtonLink to={RECORDS_MAP_PATH}>첫 방 기록하기</ButtonLink>
          </div>
        )}
      </section>

      <aside className={styles.tools} aria-label="방 구하기 도구">
        <Link className={styles.neighborhood} to={NEIGHBORHOODS_PATH}>
          <img src={neighborhoodImage} alt="" />
          <span>
            <strong>동네 찾기</strong>
            <small>어느 동네부터 볼지 모르겠다면</small>
            {isDesktop && <span className={styles.neighborhoodAction}>통근 시간으로 동네 찾기</span>}
          </span>
          <Icon name="chevron-right" size={17} />
        </Link>
        {isDesktop && canCompare && (
          <Link className={styles.desktopCompare} to={COMPARE_PATH}>
            방 비교 PDF 받기 <Icon name="chevron-right" size={16} />
          </Link>
        )}
      </aside>
    </section>
  );
};

const styles = {
  layout: css`
    --record-row-height: 5.75rem;
    --record-row-gap: 0.375rem;
    --record-list-height: calc(2 * var(--record-row-height) + var(--record-row-gap));
    --record-heading-height: 3rem;
    --record-actions-height: 2.75rem;
    --record-section-gap: 0.5rem;
    display: grid;
    align-items: start;
    gap: 0.5rem;

    & a:focus-visible,
    & [tabindex='0']:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: -2px;
    }
  `,
  desktop: css`
    --record-row-height: 6.5rem;
    --record-row-gap: 0.5rem;
    --record-section-gap: 0.75rem;
    --record-panel-padding: 1rem;
    grid-template-columns: minmax(0, 2.15fr) minmax(15rem, 1fr);
    gap: clamp(1rem, 2.6vw, 2rem);
  `,
  records: css`
    display: grid;
    min-width: 0;
    min-block-size: calc(
      var(--record-heading-height) + var(--record-list-height) + var(--record-actions-height) + 2 *
        var(--record-section-gap) + 2 * var(--record-panel-padding, 0px)
    );
    grid-template-rows: minmax(var(--record-heading-height), auto) var(--record-list-height) minmax(
        var(--record-actions-height),
        auto
      );
    gap: var(--record-section-gap);
    padding: var(--record-panel-padding, 0px);
    border-radius: var(--radius-card);
    background: var(--color-surface);

    @media (min-width: 1024px) {
      box-shadow: inset 0 0 0 1px var(--color-border);
    }
  `,
  heading: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;

    & h1 {
      margin: 0;
      font-size: 1.25rem;
      line-height: 1.25;
      letter-spacing: -0.035em;
    }

    & p {
      margin: 0.2rem 0 0;
      color: var(--color-ink-soft);
      font-size: 0.75rem;
    }

    @media (min-width: 1024px) {
      & h1 {
        font-size: 1.5rem;
      }
    }
  `,
  body: css`
    label: RecentRooms-body;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    align-items: center;
  `,
  roomList: css`
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    border-radius: var(--radius-sm);

    & ul {
      display: grid;
      grid-auto-rows: var(--record-row-height);
      gap: var(--record-row-gap);
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
  card: css`
    position: relative;
    display: grid;
    grid-template-columns: clamp(3.5rem, 24%, 8.75rem) minmax(0, 1fr) auto;
    grid-template-rows: minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    height: 100%;
    min-height: 0;
    padding: 0.375rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);

    &:hover {
      background: var(--color-surface-muted);
    }
    & > svg {
      color: var(--color-ink-soft);
    }
  `,
  photo: css`
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--color-card-surface);

    & > img,
    & > .authenticated-photo {
      width: 100%;
      height: 100%;
      aspect-ratio: auto;
      object-fit: cover;
    }

    & .authenticated-photo {
      padding: 0.125rem;
      font-size: 0.6rem;
    }

    & .authenticated-photo .inline-button {
      position: relative;
      z-index: 1;
      min-height: 1.5rem;
      padding: 0.15rem;
    }
  `,
  roomLink: css`
    display: grid;
    min-width: 0;
    gap: 0.12rem;
    color: var(--color-ink);
    text-decoration: none;
    font-size: 0.72rem;
    line-height: 1.25;

    &::after {
      position: absolute;
      inset: 0;
      border-radius: var(--radius-sm);
      content: '';
    }

    &:focus-visible::after {
      box-shadow: inset 0 0 0 2px var(--color-focus);
    }

    & > strong,
    & > small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & > strong {
      font-size: 0.86rem;
    }
    & > small {
      color: var(--color-ink-soft);
      font-size: 0.68rem;
    }

    @media (min-width: 1024px) {
      gap: 0.2rem;
      font-size: 0.82rem;
      & > strong {
        font-size: 0.95rem;
      }
      & > small {
        font-size: 0.75rem;
      }
    }
  `,
  checks: css`
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;

    & > span {
      border-radius: 0.3rem;
      background: var(--color-surface-neutral);
      padding: 0.1rem 0.23rem;
      color: var(--color-ink-soft);
      font-size: 0.6rem;
      white-space: nowrap;
    }

    & [data-tone='good'] {
      background: var(--color-memo-like);
      color: var(--color-memo-like-ink);
    }
    & [data-tone='caution'] {
      background: var(--color-memo-dislike);
      color: var(--color-memo-dislike-ink);
    }
  `,
  actions: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;

    & > a:first-child {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      min-height: 2.75rem;
      color: var(--color-brand-blue-ink);
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
    }

    & > a:first-child:hover {
      text-decoration: underline;
    }
  `,
  add: css`
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    color: var(--color-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;

    & > span {
      display: flex;
      align-items: center;
      gap: 0.22rem;
      min-height: 2rem;
      padding-inline: 0.5rem;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
    }
    &:hover > span {
      background: var(--color-surface-muted);
    }
  `,
  mobileCompare: css`
    display: inline-flex;
    flex: none;
    align-items: center;
    min-height: 2.75rem;
    color: var(--color-on-action);
    font-size: 0.7rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;

    & > span {
      display: flex;
      align-items: center;
      min-height: 2rem;
      padding-inline: 0.5rem;
      border-radius: var(--radius-sm);
      background: var(--color-action);
    }
    &:hover > span {
      background: var(--color-action-hover);
    }
  `,
  empty: css`
    grid-row: 1 / -1;
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.6rem;
    overflow: hidden;
    border-radius: var(--radius-sm);
    padding: clamp(1rem, 3vw, 2rem);
    background: color-mix(in srgb, var(--color-brand-yellow) 14%, var(--color-surface));

    & h1 {
      margin: 0;
      font-size: clamp(1.4rem, 3vw, 2.5rem);
      line-height: 1.25;
      letter-spacing: -0.04em;
    }
    & p {
      max-width: 20ch;
      margin: 0.5rem 0;
      color: var(--color-ink-soft);
      font-size: 0.86rem;
      word-break: keep-all;
    }
    & img {
      position: absolute;
      right: -1rem;
      bottom: 0.4rem;
      z-index: -1;
      width: clamp(6rem, 25%, 11rem);
      pointer-events: none;
    }
  `,
  loadError: css`
    display: grid;
    justify-items: center;
    gap: 0.45rem;
    color: var(--color-ink-soft);
    font-size: 0.85rem;
    & p {
      margin: 0;
    }
  `,
  tools: css`
    display: grid;
    gap: 0.55rem;
  `,
  neighborhood: css`
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: 1.9rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    min-height: 3rem;
    overflow: hidden;
    padding-block: 0.25rem;
    border-top: 1px solid var(--color-border);
    border-radius: 0.2rem;
    color: var(--color-ink);
    text-decoration: none;

    & img {
      width: 100%;
    }
    & strong,
    & small {
      display: block;
    }
    & strong {
      font-size: 0.87rem;
    }
    & small {
      color: var(--color-ink-soft);
      font-size: 0.72rem;
    }
    &:hover strong {
      text-decoration: underline;
    }

    @media (min-width: 1024px) {
      grid-template-columns: minmax(0, 1fr) auto;
      min-height: 8.8rem;
      padding: 0.9rem 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
      background: color-mix(in srgb, var(--color-brand-blue) 14%, var(--color-surface));

      & img {
        position: absolute;
        right: -0.9rem;
        bottom: -1.7rem;
        z-index: -1;
        width: 7.6rem;
      }
      & strong {
        font-size: 1.15rem;
      }
      & small {
        max-width: 16ch;
      }
      & > svg {
        display: none;
      }
    }
  `,
  neighborhoodAction: css`
    display: block;
    margin-top: 0.65rem;
    color: var(--color-brand-blue-ink);
    font-size: 0.78rem;
    font-weight: 700;
  `,
  desktopCompare: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 2.75rem;
    padding-inline: 0.7rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-ink);
    font-size: 0.8rem;
    font-weight: 700;
    text-decoration: none;
    &:hover {
      background: var(--color-surface-muted);
    }
  `,
};

export default RecentRooms;
