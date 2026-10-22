import { type CSSProperties, type ReactNode } from 'react';

import { useKeyboardInset } from '@/shared/lib/hooks/useKeyboardInset';
import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';

import styles from './PropertyEditSheet.module.css';

type PropertyEditSheetProps = {
  title: string;
  initialHeightPercent: number;
  children: ReactNode;
  onClose: () => void;
};

/**
 * 상세 화면 위에 띄우는 수정 시트. 동네 찾기 필터 시트처럼 높이를 끌어 바꿀 수 없고,
 * 바깥(어두운 배경)을 누르거나 닫기·Esc로 닫는다. 키보드가 올라오면 시트를 키보드 위로 올린다.
 */
const PropertyEditSheet = ({ title, initialHeightPercent, children, onClose }: PropertyEditSheetProps) => {
  const keyboardInset = useKeyboardInset();

  return (
    <div className={styles.layer} style={{ '--keyboard-inset': `${keyboardInset}px` } as CSSProperties}>
      <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      <div className={styles.frame}>
        <BottomSheet
          title={title}
          closeLabel={`${title} 닫기`}
          initialHeightPercent={initialHeightPercent}
          resizable={false}
          onClose={onClose}
        >
          {children}
        </BottomSheet>
      </div>
    </div>
  );
};

export default PropertyEditSheet;
