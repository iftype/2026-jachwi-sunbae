import { ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

/** 비교하려면 매물이 2개 이상 있어야 한다는 안내. */
const CompareEmpty = () => (
  <EmptyState
    variant="plain"
    title="비교하려면 매물이 2개 필요해요."
    description="매물을 하나 더 등록한 뒤 기록을 나란히 확인해 보세요."
    action={<ButtonLink to="/properties/new">매물 등록하기</ButtonLink>}
  />
);

export default CompareEmpty;
