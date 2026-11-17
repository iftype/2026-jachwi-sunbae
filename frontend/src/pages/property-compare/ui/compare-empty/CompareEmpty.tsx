import { RECORDS_MAP_PATH } from '@/shared/lib/navigation/appPaths';
import { ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

/** 등록한 매물이 하나도 없을 때의 안내. 하나라도 있으면 목록을 보이고 골라서 PDF로 받는다. */
const CompareEmpty = () => (
  <EmptyState
    variant="plain"
    illustration="empty-properties"
    title="PDF로 받을 매물이 아직 없어요."
    description="본 방 기록 지도에서 본 방을 먼저 등록해 보세요."
    action={<ButtonLink to={RECORDS_MAP_PATH}>본 방 기록에서 등록하기</ButtonLink>}
  />
);

export default CompareEmpty;
