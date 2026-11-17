import { css } from '@emotion/css';
import { type MouseEventHandler, type ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ChecklistProgressBar from '@/features/checklist/ui/checklist-progress-bar/ChecklistProgressBar';
import { propertyDetailPath } from '@/shared/lib/navigation/appPaths';

import type { PropertyReturnPath } from '../../lib/propertyNavigation';
import type { PropertySummary } from '../../model/Property';
import AuthenticatedPhoto from '../authenticated-photo/AuthenticatedPhoto';
import PropertyAddress from '../property-address/PropertyAddress';
import PropertyPlaceholderPhoto from '../property-placeholder-photo/PropertyPlaceholderPhoto';
import PropertyPrice from '../property-price/PropertyPrice';

type PropertyPhotoThumbnailProps = {
  property: PropertySummary;
  thumbnailUrl?: string;
  onActivate?: () => void;
};

/** 목록 카드에는 대표 사진 한 장만 보여 준다. 나머지 사진은 매물 상세에서 본다. */
const PropertyPhotoThumbnail = ({ property, thumbnailUrl, onActivate }: PropertyPhotoThumbnailProps) => {
  const [failed, setFailed] = useState(false);
  const photo = property.representativePhoto ?? property.photos?.[0] ?? null;
  const contentUrl = thumbnailUrl ?? photo?.contentUrl ?? property.photoUrls?.[0];

  return (
    <button type="button" className={styles.photo} aria-label={`${property.name} 상세 보기`} onClick={onActivate}>
      {contentUrl === undefined || failed ? (
        <div className={styles.emptyPhoto} role="img" aria-label="등록된 사진 없음">
          {/* 사진이 없는 매물은 기본 이미지(집 그림)로 채운다. */}
          <PropertyPlaceholderPhoto />
        </div>
      ) : photo !== null ? (
        <AuthenticatedPhoto
          propertyId={property.propertyId}
          photoId={photo.photoId}
          contentUrl={contentUrl}
          alt={`${property.name} 대표 사진`}
        />
      ) : (
        <img src={contentUrl} alt={`${property.name} 대표 사진`} draggable={false} onError={() => setFailed(true)} />
      )}
    </button>
  );
};

type PropertyCardProps = {
  property: PropertySummary;
  thumbnailUrl?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  returnTo?: PropertyReturnPath;
  returnState?: unknown;
  /** 상세 주소. 기본은 `/properties/:propertyId`이고, 화면별로 다른 주소를 줄 수 있다. */
  to?: string;
  /** 주면 사진·본문을 눌러도 상세로 이동하지 않고 이 함수를 부른다. 데스크탑 기록 화면처럼 옆에 상세를 열 때 쓴다. */
  onOpen?: () => void;
  /** 카드 오른쪽 위에 둘 버튼(더보기 메뉴 등). */
  actions?: ReactNode;
  /** 가격 아래 덧붙이는 한 줄. 본 방 기록은 출퇴근 장소까지 통근 시간을 둔다. */
  meta?: ReactNode;
  /** 이름 위에 붙이는 작은 한 줄. 본 방 기록은 목적지까지 거리를 둔다. */
  eyebrow?: ReactNode;
};

const PropertyCard = ({
  property,
  thumbnailUrl,
  onClick,
  returnTo,
  returnState,
  to,
  onOpen,
  actions,
  meta,
  eyebrow,
}: PropertyCardProps) => {
  const navigate = useNavigate();
  const detailPath = to ?? propertyDetailPath(property.propertyId);
  const onSiteStage = property.stages.find((stage) => stage.stage === 'ON_SITE');

  return (
    <article className={styles.listItem}>
      <div className={styles.visual}>
        <PropertyPhotoThumbnail
          property={property}
          thumbnailUrl={thumbnailUrl}
          onActivate={() =>
            onOpen !== undefined ? onOpen() : navigate(detailPath, { state: { returnTo, returnState } })
          }
        />
      </div>

      <Link
        className={styles.mainLink}
        to={detailPath}
        state={{ returnTo, returnState }}
        aria-label={property.name}
        onClick={(event) => {
          onClick?.(event);
          if (onOpen === undefined || event.defaultPrevented) return;
          event.preventDefault();
          onOpen();
        }}
      >
        <div className={styles.details}>
          {eyebrow !== undefined && <span className={styles.eyebrow}>{eyebrow}</span>}
          <strong className={styles.title}>{property.name}</strong>
          <PropertyPrice
            className={styles.price}
            depositAmount={property.depositAmount}
            monthlyRentAmount={property.monthlyRentAmount}
            variant="labeled"
          />
          {meta !== undefined && <span className={styles.meta}>{meta}</span>}
          <small className={styles.address}>
            <PropertyAddress address={property.location.address} />
          </small>
        </div>
        {onSiteStage !== undefined && (
          <div className={styles.stageProgress} aria-label="현장 체크리스트 진행 현황">
            {onSiteStage.applied ? (
              // 진행 막대와 상태별 개수만 보여 주고, 끝의 완료 개수(예: 0/4)는 두지 않는다.
              <ChecklistProgressBar progress={onSiteStage.progress} compact />
            ) : (
              <>
                <span className={styles.inactiveBar} aria-hidden="true" />
                <div className={styles.stageStartHint}>
                  <strong>시작 전</strong>
                </div>
              </>
            )}
          </div>
        )}
      </Link>
      {actions !== undefined && <div className={styles.actions}>{actions}</div>}
    </article>
  );
};

const styles = {
  listItem: css`
    label: PropertyCard-listItem;
    display: flex;
    min-width: 0;
    align-items: stretch;
    gap: 0.875rem;
    padding: 0.425rem 0;
    border-bottom: 0;
    background: var(--color-canvas, #fff);
    color: inherit;
  `,

  visual: css`
    label: PropertyCard-visual;
    width: 6.7rem;
    min-height: 8.5rem;
    flex: 0 0 6.7rem;
    overflow: hidden;
    border-radius: var(--radius-sm, 0.65rem);
    background: var(--color-surface-muted, #f7f7f7);
  `,

  photo: css`
    label: PropertyCard-photo;
    border: 0;
    padding: 0;
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    background: var(--color-surface-muted, #f7f7f7);
    color: var(--color-muted, #868b94);
    cursor: pointer;

    & img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  emptyPhoto: css`
    label: PropertyCard-emptyPhoto;
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: var(--color-muted, #868b94);

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  actions: css`
    label: PropertyCard-actions;
    position: relative;
    flex: none;
    align-self: flex-start;
  `,

  mainLink: css`
    label: PropertyCard-mainLink;
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 0.35rem;
    color: inherit;
    text-decoration: none;
  `,

  eyebrow: css`
    label: PropertyCard-eyebrow;
    display: inline-flex;
    align-self: flex-start;
    width: fit-content;
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    background: color-mix(in srgb, var(--color-brand-blue-ink, #3f6fc4) 12%, transparent);
    color: var(--color-brand-blue-ink, #3f6fc4);
    font-size: 0.72rem;
    font-weight: 700;
  `,

  details: css`
    label: PropertyCard-details;
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.25rem;
  `,

  title: css`
    label: PropertyCard-title;
    overflow: hidden;
    color: var(--color-ink, #212124);
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.3;
    letter-spacing: -0.03em;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  price: css`
    label: PropertyCard-price;
    margin: 0;
    color: var(--color-ink, #212124);
    font-size: 0.8rem;
    font-weight: 400;
  `,

  meta: css`
    label: PropertyCard-meta;
    margin: 0;
    color: var(--color-primary-strong, #1d4ed8);
    font-size: 0.76rem;
    font-weight: 600;
  `,

  address: css`
    label: PropertyCard-address;
    margin: 0;
    overflow: hidden;
    color: var(--color-muted, #868b94);
    font-size: 0.76rem;
    font-weight: 400;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  stageProgress: css`
    label: PropertyCard-stageProgress;
    display: grid;
    gap: 0.3rem;
    /* 넓은 목록에서 막대가 카드 끝(스크롤 막대)까지 길게 늘어지지 않게 폭을 제한한다. */
    width: min(100%, 16rem);
    margin-top: 0.2rem;
    padding-top: 0.1rem;
  `,

  stageStartHint: css`
    label: PropertyCard-stageStartHint;
    display: flex;
    justify-content: flex-end;
    color: var(--color-ink, #212124);
    font-size: 0.74rem;
    font-weight: 500;

    /* strong 기본 굵기가 카드에서 제일 무거워지지 않게 맞춘다. */
    & strong {
      font-weight: inherit;
    }
  `,

  inactiveBar: css`
    label: PropertyCard-inactiveBar;
    display: block;
    width: 100%;
    height: 0.3rem;
    margin-top: 0.2rem;
    border-radius: 999px;
    background: var(--color-border, #eaebed);
  `,
};

export default PropertyCard;
