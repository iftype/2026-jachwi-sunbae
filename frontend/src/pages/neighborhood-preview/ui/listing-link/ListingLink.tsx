import dabangIcon from '@/shared/assets/dabang-app-icon.png';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import type { ListingCoordinate } from '../../model/externalListings';
import { dabangListingUrl } from '../../model/externalListings';
import AreaActionCard from '../area-action-card/AreaActionCard';

type ListingLinkProps = {
  areaName: string;
  center: ListingCoordinate;
  className?: string;
  onOpen?: () => void;
};

/** 선택한 동네 좌표로 다방 지도를 새 탭에 연다. 데스크톱 폭이 아니면 다방 모바일 지도로 연다. */
const ListingLink = ({ areaName, center, className, onOpen }: ListingLinkProps) => {
  const isDesktop = useIsDesktop();
  return (
    <AreaActionCard
      icon={<img src={dabangIcon} alt="" width={44} height={44} />}
      title="현재 매물 확인하기"
      description={`다방에서 ${areaName} 원·투룸 보기`}
      link={{ href: dabangListingUrl(center, isDesktop ? 'desktop' : 'mobile') }}
      className={className}
      onOpen={onOpen}
    />
  );
};

export default ListingLink;
