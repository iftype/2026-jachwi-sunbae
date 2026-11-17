import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { subscribePreviewNotSaved } from '@/features/property/api/previewPropertyApi';
import Toast from '@/shared/ui/toast/Toast';

/** 미리보기 매물을 고치려 하면 화면 아래에 저장되지 않는다고 알린다. */
const PreviewNotSavedToast = () => {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => subscribePreviewNotSaved(() => setIsOpen(true)), []);

  return (
    <Toast
      title="미리보기 매물은 저장되지 않아요"
      description="첫 방을 기록하면 직접 고칠 수 있어요."
      isOpen={isOpen}
      onClose={close}
      duration={3000}
      className={styles.toast}
    />
  );
};

/* 상세가 길게 스크롤돼도 화면 아래 가운데에 보이게 고정한다. */
const styles = {
  toast: css`
    && {
      position: fixed;
      right: 0;
      left: 0;
      z-index: 1000;
      width: min(24rem, calc(100% - 2rem));
      margin-inline: auto;
    }
  `,
};

export default PreviewNotSavedToast;
