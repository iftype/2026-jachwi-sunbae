import { getPropertyErrorMessage } from '@/features/property/api/propertyErrorMessages';
import type { usePropertyList } from '@/features/property/api/useProperties';
import { Button } from '@/shared/ui/button/Button';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';

import styles from './CompareLoadState.module.css';

/** 비교할 매물을 불러오는 중이거나 불러오지 못했을 때의 안내. 둘 다 아니면 그리지 않는다. */
const CompareLoadState = ({ properties }: { properties: ReturnType<typeof usePropertyList> }) => {
  if (properties.isPending)
    return (
      <div className={styles.loading} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        매물을 불러오는 중이에요.
      </div>
    );
  if (properties.isError)
    return (
      <div className={styles.errorState}>
        <InlineNotice tone="error">{getPropertyErrorMessage(properties.error)}</InlineNotice>
        <Button variant="secondary" fullWidth onClick={() => void properties.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  return null;
};

export default CompareLoadState;
