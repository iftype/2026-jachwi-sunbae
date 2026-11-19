import { css } from '@emotion/css';

import dabangIcon from '@/shared/assets/dabang-app-icon.png';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import Icon from '@/shared/ui/icon/Icon';

import type { ListingCoordinate } from '../../model/externalListings';
import { dabangListingUrl } from '../../model/externalListings';
import AreaActionCard from '../area-action-card/AreaActionCard';

type ListingLinkProps = {
  areaName: string;
  center: ListingCoordinate;
  className?: string;
  onOpen?: () => void;
  /** card는 설명이 있는 카드, icon은 시트 제목 오른쪽 끝에 두는 작은 버튼(다방 아이콘, 한 줄 `현재 지역의 매물은?`, 외부 링크 표시)이다. */
  variant?: 'card' | 'icon';
};

/** 선택한 동네 좌표로 다방 지도를 새 탭에 연다. 데스크톱 폭이 아니면 다방 모바일 지도로 연다. */
const ListingLink = ({ areaName, center, className, onOpen, variant = 'card' }: ListingLinkProps) => {
  const isDesktop = useIsDesktop();
  const href = dabangListingUrl(center, isDesktop ? 'desktop' : 'mobile');
  if (variant === 'icon')
    return (
      <a
        className={className ? `${styles.icon} ${className}` : styles.icon}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`다방에서 ${areaName} 원·투룸 보기`}
        onClick={onOpen}
      >
        <img src={dabangIcon} alt="" width={24} height={24} />
        <span aria-hidden="true">현재 지역의 매물은?</span>
        {/* 다른 앱(다방)으로 넘어간다는 표시. */}
        <Icon name="external-link" size={14} />
      </a>
    );
  return (
    <AreaActionCard
      icon={<img src={dabangIcon} alt="" width={36} height={36} />}
      title="현재 매물 확인하기"
      description={`다방에서 ${areaName} 원·투룸 보기`}
      link={{ href }}
      className={className}
      onOpen={onOpen}
    />
  );
};

const styles = {
  icon: css`
    label: ListingLink-icon;
    display: flex;
    height: 2.75rem;
    flex: none;
    align-items: center;
    gap: 0.4rem;
    padding: 0 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 0.7rem;
    background: white;
    color: var(--color-ink);
    text-decoration: none;

    & img {
      border-radius: 0.4rem;
    }

    & span {
      font-size: 0.72rem;
      font-weight: 650;
      line-height: 1.25;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }

    & svg {
      flex: none;
      color: var(--color-muted);
    }
  `,
};

export default ListingLink;
