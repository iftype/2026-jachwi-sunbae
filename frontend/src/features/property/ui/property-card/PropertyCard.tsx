import { type MouseEventHandler, type ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ChecklistProgressBar from '@/features/checklist/ui/checklist-progress-bar/ChecklistProgressBar';
import mascotImage from '@/shared/assets/jachwi-sunbae-goose.webp';

import { formatManwon } from '../../lib/propertyFormat';
import type { PropertyReturnPath } from '../../lib/propertyNavigation';
import type { PropertySummary } from '../../model/Property';
import AuthenticatedPhoto from '../authenticated-photo/AuthenticatedPhoto';

import styles from './PropertyCard.module.css';

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
          <img src={mascotImage} alt="" />
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
  /** 상세 주소. 기본은 `/properties/:propertyId`이고, 지도에서는 `/map/:propertyId`처럼 화면별 주소를 준다. */
  to?: string;
  /** 주면 사진·본문을 눌러도 상세로 이동하지 않고 이 함수를 부른다. 데스크탑 기록 화면처럼 옆에 상세를 열 때 쓴다. */
  onOpen?: () => void;
  /** 카드 오른쪽 위에 둘 버튼(더보기 메뉴 등). */
  actions?: ReactNode;
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
}: PropertyCardProps) => {
  const navigate = useNavigate();
  const detailPath = to ?? `/properties/${property.propertyId}`;
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
          <strong className={styles.title}>{property.name}</strong>
          <span className={styles.price}>
            보증금 {formatManwon(property.depositAmount)} / 월세 {formatManwon(property.monthlyRentAmount)}
          </span>
          {property.location.address !== null && <small className={styles.address}>{property.location.address}</small>}
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

export default PropertyCard;
