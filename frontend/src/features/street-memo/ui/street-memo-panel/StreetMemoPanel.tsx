import Icon from '@/shared/ui/icon/Icon';
import IconButton from '@/shared/ui/icon-button/IconButton';

import type { StreetMemoLayer } from '../../hooks/useStreetMemoLayer';
import type { StreetMemo } from '../../model/StreetMemo';
import StreetMemoContent, { streetMemoTitle } from '../street-memo-content/StreetMemoContent';

import styles from './StreetMemoPanel.module.css';

type Props = {
  layer: StreetMemoLayer;
  onCreated?: (memo: StreetMemo) => void;
  /** 화면이 이미 닫기 버튼을 그리는 칸(ListDetailLayout 등)이면 끈다. */
  showCloseButton?: boolean;
  className?: string;
};

/** 데스크탑에서 메모를 쓰거나 보는 칸. 놓을 자리(지도 위 카드·목록 옆 칸)는 화면이 className으로 정한다. */
const StreetMemoPanel = ({ layer, onCreated, showCloseButton = true, className }: Props) => {
  if (layer.mode === null) return null;
  const title = streetMemoTitle(layer);
  return (
    <section className={`${styles.panel} ${className ?? ''}`.trim()} aria-label={title}>
      <header className={styles.header}>
        <h2>{title}</h2>
        {showCloseButton && (
          <IconButton label="메모 닫기" onClick={layer.close}>
            <Icon name="close" size={22} />
          </IconButton>
        )}
      </header>
      <StreetMemoContent layer={layer} onCreated={onCreated} />
    </section>
  );
};

export default StreetMemoPanel;
