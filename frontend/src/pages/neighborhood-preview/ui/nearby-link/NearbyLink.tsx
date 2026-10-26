import Icon from '@/shared/ui/icon/Icon';

import AreaActionCard from '../area-action-card/AreaActionCard';

type NearbyLinkProps = {
  areaName: string;
  to: string;
  className?: string;
  onOpen?: () => void;
};

/** 동네 중심 좌표로 정류장·공인중개사 같은 주변 시설 분석 화면을 연다. */
const NearbyLink = ({ areaName, to, className, onOpen }: NearbyLinkProps) => (
  <AreaActionCard
    icon={<Icon name="map" size={22} />}
    title="정류장·공인중개사 보기"
    description={`${areaName} 주변 시설 분석`}
    link={{ to }}
    className={className}
    onOpen={onOpen}
  />
);

export default NearbyLink;
