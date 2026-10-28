import { getPropertyErrorMessage } from '@/features/property/api/propertyErrorMessages';
import ContentState from '@/shared/ui/content-state/ContentState';

type Props = {
  error: unknown;
  onRetry: () => void;
  className?: string;
};

/** 기록 목록을 불러오지 못했을 때 지도·리스트 자리에 보여 주는 안내. 데스크탑·휴대폰 화면이 함께 쓴다. */
const RecordLoadError = ({ error, onRetry, className }: Props) => (
  <div className={className}>
    <ContentState
      page={false}
      tone="error"
      title="기록을 불러오지 못했어요."
      description={getPropertyErrorMessage(error)}
      onRetry={onRetry}
    />
  </div>
);

export default RecordLoadError;
