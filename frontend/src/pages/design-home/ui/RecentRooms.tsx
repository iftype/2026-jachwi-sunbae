import { css, cx } from '@emotion/css';
import { Link } from 'react-router-dom';

import { usePropertyList } from '@/features/property/api/useProperties';
import { withPreviewProperties } from '@/features/property/model/sampleProperties';
import PropertyCard from '@/features/property/ui/property-card/PropertyCard';
import {
  COMPARE_PATH,
  HOME_PATH,
  NEIGHBORHOODS_PATH,
  RECORDS_MAP_PATH,
  RECORDS_PATH,
} from '@/shared/lib/navigation/appPaths';
import { Button } from '@/shared/ui/button/Button';
import DelayedFallback from '@/shared/ui/delayed-fallback/DelayedFallback';
import Icon from '@/shared/ui/icon/Icon';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';

import neighborhoodImage from '../assets/card-neighborhood.webp';

type RecentRoomsProps = {
  readonly isDesktop?: boolean;
};

/** 휴대폰 홈에 펼쳐 보이는 최근 방 수. 나머지는 전체 보기에서 본다. */
const MOBILE_ROOM_LIMIT = 10;

const RecentRooms = ({ isDesktop = false }: RecentRoomsProps) => {
  const properties = usePropertyList();
  const loadedRooms = properties.data?.pages.flatMap((page) => page.content) ?? [];
  const totalRooms = properties.data?.pages[0]?.totalElements ?? 0;
  const hasRooms = loadedRooms.length > 0;
  // 아직 기록이 없으면 같은 카드 모양으로 미리보기 매물을 보여 준다.
  const { properties: rooms, isPreview: isSample } = withPreviewProperties(loadedRooms, properties.isSuccess);
  const canCompare = totalRooms >= 1;
  const heading = isDesktop ? '내가 기록한 방' : '최근 기록한 방';
  const addRoom = (
    <Link className={styles.add} to={RECORDS_MAP_PATH}>
      <Icon name="plus" size={19} /> 방 기록하기
    </Link>
  );

  return (
    <section className={cx(styles.layout, isDesktop && styles.desktop)} aria-label="자취선배 주요 기능">
      <section className={styles.records} aria-labelledby="recent-heading">
        <header className={styles.heading}>
          <div className={styles.titleRow}>
            <h1 id="recent-heading">{heading}</h1>
            {canCompare && (
              <Link to={COMPARE_PATH} className={styles.mobileCompare}>
                <span>방 비교 PDF 받기</span>
              </Link>
            )}
          </div>
          {hasRooms && (
            // 주소에 보기 방식을 넣지 않아, 본 방 기록에서 마지막으로 고른 보기(지도, 리스트)로 열린다.
            <Link to={RECORDS_PATH} className={styles.viewAll}>
              전체 보기 <Icon name="chevron-right" size={15} />
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
                    {(isDesktop ? rooms : rooms.slice(0, MOBILE_ROOM_LIMIT)).map((room) => (
                      <li key={room.propertyId}>
                        {/* 본 방 기록과 같은 카드. 미리보기 매물도 상세가 열린다. */}
                        <PropertyCard property={room} returnTo={HOME_PATH} />
                      </li>
                    ))}
                  </ul>
                  {isDesktop && properties.hasNextPage && (
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
        {(hasRooms || isSample) && addRoom}
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
    --record-panel-padding: 0.75rem;
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
    /* 바탕이 흰색이라 목록 안쪽 여백을 없애 제목 윗선과 동네 찾기 카드 윗선을 맞춘다. */
    --record-panel-padding: 0;
    grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem);
    gap: clamp(1.5rem, 4vw, 3.5rem);

    /* 데스크탑은 휴대폰보다 글자를 조금 작게 둔다. */
    & header a[href] {
      font-size: 0.78rem;
    }

    /* 동네 찾기를 제목 줄만큼 내려 첫 매물 카드 윗선에 맞춘다. 제목 줄 높이(2.75rem)와 줄 사이(0.75rem)를 더한 값이다. */
    & > aside {
      padding-top: calc(2.75rem + var(--record-section-gap));
    }
  `,
  records: css`
    display: grid;
    min-width: 0;
    gap: var(--record-section-gap);
    padding: var(--record-panel-padding);
    border-radius: var(--radius-card);
    background: var(--color-surface);
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
        font-size: 1.25rem;
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
    /* 데스크탑은 카드 세 장쯤 보이고 나머지는 칸 안에서 스크롤한다. 휴대폰은 칸 스크롤 없이 페이지 흐름대로 펼친다. */
    @media (min-width: 1024px) {
      max-height: 28rem;
      overflow-y: auto;
      scrollbar-gutter: stable;
    }
    border-radius: var(--radius-sm);

    & ul {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.5rem;
      margin: 0;
      /* 떠오른 첫 카드 윗부분이 스크롤 칸에 잘리지 않게 위를 조금 비운다. */
      padding: 2px 0 0;
      list-style: none;
    }

    /* 매물 카드에 올리면 바탕을 살짝 칠해 누를 수 있는 줄임을 보인다. */
    & ul > li {
      padding: 0.4rem;
      border-radius: var(--radius-card);
      transition:
        background-color 160ms ease,
        transform 160ms ease;
    }
    /* 올리면 바탕이 옅은 파랑으로 바뀌며 살짝 떠오른다. 테두리나 그림자는 두지 않는다. */
    & ul > li:hover {
      background: color-mix(in srgb, var(--color-brand-blue) 7%, #fff);
      transform: translateY(-2px);
    }
    /* 카드 빈 곳(여백, 오른쪽 공간)을 눌러도 상세로 가게 본문 링크를 카드 전체로 넓힌다. 사진과 메뉴는 그 위에 둔다. */
    & ul > li {
      position: relative;
      cursor: pointer;
    }
    & ul > li article > a::after {
      position: absolute;
      inset: 0;
      content: '';
    }
    & ul > li article > :not(a) {
      position: relative;
      z-index: 1;
    }
    /* 공용 매물 카드는 흰 바탕을 깔고 있어, 홈 목록에서는 투명하게 두어 위 호버 바탕이 비치게 한다. */
    & ul > li > * {
      background: transparent;
    }

    @media (prefers-reduced-motion: reduce) {
      & ul > li {
        transition: none;
      }
      & ul > li:hover {
        transform: none;
      }
    }
  `,
  titleRow: css`
    display: flex;
    align-items: center;
    gap: 0.5rem;
  `,
  viewAll: css`
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    min-height: 2.75rem;
    color: var(--color-brand-blue-ink);
    font-size: 0.9rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      text-decoration: underline;
    }
  `,
  /* 화면 아래 가운데에 떠 있는 날렵한 알약 모양 추가 버튼. 목록이 길어져도 늘 같은 자리에 있다. */
  add: css`
    position: fixed;
    bottom: calc(4rem + env(safe-area-inset-bottom));
    left: 50%;
    z-index: 50;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 3.2rem;
    padding: 0 1.6rem 0 1.3rem;
    border-radius: 999px;
    background: var(--color-brand-blue-ink);
    box-shadow: 0 6px 18px rgb(63 111 196 / 32%);
    color: #fff;
    font-size: 1rem;
    transform: translateX(-50%);

    /* PC는 화면이 높아 바닥에서 더 띄운다. */
    @media (min-width: 1024px) {
      bottom: 6rem;
    }
    font-weight: 800;
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      background: color-mix(in srgb, var(--color-brand-blue-ink) 85%, black);
    }
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
  mobileCompare: css`
    display: inline-flex;
    flex: none;
    align-items: center;
    min-height: 2.75rem;
    color: var(--color-brand-blue-ink);
    font-size: 0.78rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;

    /* 제목 옆 보조 동작이라 진한 버튼 대신 옅은 파랑 알약으로 둔다. */
    & > span {
      display: flex;
      align-items: center;
      min-height: 1.75rem;
      padding-inline: 0.65rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-brand-blue) 14%, #fff);
    }
    &:hover > span {
      background: color-mix(in srgb, var(--color-brand-blue) 24%, #fff);
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
    /* 휴대폰은 글자를 왼쪽, 그림을 오른쪽(화살표 앞)에 둔다. */
    grid-template-columns: minmax(0, 1fr) 4rem auto;
    align-items: center;
    gap: 0.6rem;
    /* 글자 크기는 예전 홈 카드(--home-card-*)를 쓰고, 높이는 낮게 둔다. */
    min-height: 3.9rem;
    overflow: hidden;
    padding: 0.5rem 1rem 0.5rem 1.25rem;
    border-radius: var(--radius-card);
    /* 예전 이용 가이드 카드처럼 옅은 파랑 바탕에, 그림이 놓인 오른쪽 아래에 조금 더 진한 파란빛을 깐다. */
    background:
      radial-gradient(
        circle 6.5rem at right 2.5rem top 72%,
        color-mix(in srgb, var(--color-brand-blue) 50%, transparent),
        color-mix(in srgb, var(--color-brand-blue) 18%, transparent) 55%,
        transparent 100%
      ),
      color-mix(in srgb, var(--color-brand-blue) 16%, #fff);
    color: var(--color-ink);
    text-decoration: none;

    & img {
      width: 100%;
    }
    & strong,
    & small {
      display: block;
    }
    /* 예전 이용 가이드 카드처럼 회색 질문을 위에, 진한 파랑 제목을 아래에 둔다. */
    & > span {
      display: flex;
      order: -1;
      flex-direction: column;
    }
    & strong {
      color: var(--color-brand-blue-ink);
      font-size: var(--home-card-title-size);
      font-weight: 800;
    }
    & small {
      order: -1;
      margin-bottom: 0.15rem;
      color: var(--color-muted);
      font-size: var(--home-card-description-size);
    }
    /* 올리면 살짝 떠오른다. 그림자는 두지 않는다. */
    transition: transform 160ms ease;
    &:hover {
      transform: translateY(-2px);
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
      &:hover {
        transform: none;
      }
    }

    @media (min-width: 1024px) {
      grid-template-columns: minmax(0, 1fr) auto;
      /* 첫 매물 카드와 같은 높이. 윗선도 첫 카드에 맞춘다(아래 desktop의 aside 여백). */
      min-height: 8.5rem;
      padding: 0.9rem 1.1rem;
      /* 글자는 위에 붙여 두고 카드만 아래로 늘린다. */
      align-items: start;

      & strong {
        font-size: 1.55rem;
      }
      /* 질문 문구는 한 줄로 둔다. */
      & small {
        margin-bottom: 0.2rem;
        font-size: 0.88rem;
        white-space: nowrap;
      }

      & img {
        position: absolute;
        right: -0.9rem;
        bottom: -1.6rem;
        z-index: -1;
        width: 8.5rem;
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
};

export default RecentRooms;
